import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireTenant, resolveTenantRead } from "./tenants";
import {
  aestheticValidator,
  CREDIT_COST,
  engineValidator,
} from "./engineConfig";

// ---------------------------------------------------------------------------
// Bulk processing — CSV batches (tenant-scoped asynchronous pipeline)
// ---------------------------------------------------------------------------

export const listBatches = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveTenantRead(ctx);
    if (!resolved) return [];
    const { tenant } = resolved;
    return ctx.db
      .query("batches")
      .withIndex("by_tenant_created", (q) => q.eq("tenantId", tenant._id))
      .order("desc")
      .take(30);
  },
});

export const createBatch = mutation({
  args: {
    name: v.string(),
    engine: engineValidator,
    aesthetic: aestheticValidator,
    rows: v.array(
      v.object({
        sku: v.string(),
        garmentUrl: v.string(),
        modelUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { name, engine, aesthetic, rows }) => {
    const { tenant, userId } = await requireTenant(ctx);

    if (rows.length === 0) throw new Error("CSV produced no usable rows");
    if (rows.length > 500) throw new Error("Batch limit is 500 rows per CSV run.");

    const needed = rows.length * CREDIT_COST;
    if (tenant.credits < needed) {
      throw new Error(
        `Batch needs ${needed} credits — workspace holds ${tenant.credits}. Top up in Billing.`,
      );
    }

    const batchId = await ctx.db.insert("batches", {
      tenantId: tenant._id,
      userId,
      name,
      engine,
      aesthetic,
      totalRows: rows.length,
      processedRows: 0,
      failedRows: 0,
      status: "running",
      createdAt: Date.now(),
    });

    for (const row of rows) {
      const jobId = await ctx.db.insert("jobs", {
        tenantId: tenant._id,
        userId,
        batchId,
        sku: row.sku,
        garmentUrl: row.garmentUrl,
        modelUrl: row.modelUrl,
        engine,
        aesthetic,
        lighting: { keyIntensity: 55, fillRatio: 2, warmth: 50 },
        status: "queued",
        costCredits: CREDIT_COST,
        createdAt: Date.now(),
      });
      await ctx.db.insert("creditLedger", {
        tenantId: tenant._id,
        userId,
        delta: -CREDIT_COST,
        reason: `Batch ${name} — SKU ${row.sku}`,
        jobId,
        batchId,
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(tenant._id, { credits: tenant.credits - needed });

    return { batchId, queued: rows.length };
  },
});

export const incrementBatchFailure = internalMutation({
  args: { batchId: v.id("batches") },
  handler: async (ctx, { batchId }) => {
    const batch = await ctx.db.get(batchId);
    if (!batch) return;
    await ctx.db.patch(batchId, { failedRows: batch.failedRows + 1 });
  },
});

export const getBatchInternal = internalQuery({
  args: { batchId: v.id("batches") },
  handler: async (ctx, { batchId }) => await ctx.db.get(batchId),
});

// ---------------------------------------------------------------------------
// Billing — tenant credit packs and enterprise invoicing
// ---------------------------------------------------------------------------

export const CREDIT_PACKS = {
  starter: { credits: 200, priceCents: 1900, label: "Starter pack" },
  studio: { credits: 1000, priceCents: 7900, label: "Studio pack" },
  atelier: { credits: 5000, priceCents: 29900, label: "Atelier pack" },
} as const;

export const topUpCredits = mutation({
  args: { packId: v.string() },
  handler: async (ctx, { packId }) => {
    const { tenant, userId } = await requireTenant(ctx);

    const pack = CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS];
    if (!pack) throw new Error("Unknown credit pack");

    await ctx.db.patch(tenant._id, { credits: tenant.credits + pack.credits });
    await ctx.db.insert("creditLedger", {
      tenantId: tenant._id,
      userId,
      delta: pack.credits,
      reason: `Purchased ${pack.label}`,
      createdAt: Date.now(),
    });
    return { credits: tenant.credits + pack.credits };
  },
});

export const listLedger = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveTenantRead(ctx);
    if (!resolved) return [];
    const { tenant } = resolved;
    return ctx.db
      .query("creditLedger")
      .withIndex("by_tenant_created", (q) => q.eq("tenantId", tenant._id))
      .order("desc")
      .take(50);
  },
});

export const listInvoices = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveTenantRead(ctx);
    if (!resolved) return [];
    const { tenant } = resolved;
    return ctx.db
      .query("invoices")
      .withIndex("by_tenant_created", (q) => q.eq("tenantId", tenant._id))
      .order("desc")
      .take(50);
  },
});

export const settleInvoice = mutation({
  args: { invoiceId: v.id("invoices"), settledVia: v.string() },
  handler: async (ctx, { invoiceId, settledVia }) => {
    const { tenant } = await requireTenant(ctx);
    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    if (inv.tenantId !== tenant._id) throw new Error("Not your invoice");
    await ctx.db.patch(invoiceId, {
      status: "paid" as const,
      paidAt: Date.now(),
      settledVia,
    });
  },
});
