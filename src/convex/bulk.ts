import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  aestheticValidator,
  CREDIT_COST,
  engineValidator,
} from "./engineConfig";

// ---------------------------------------------------------------------------
// Bulk processing — CSV batches (MSME-scale asynchronous pipeline)
// ---------------------------------------------------------------------------

export const listBatches = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("batches")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (rows.length === 0) throw new Error("CSV produced no usable rows");
    if (rows.length > 500) throw new Error("Batch limit is 500 rows per CSV run.");

    const acct = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!acct) throw new Error("Account not found");
    const needed = rows.length * CREDIT_COST;
    if (acct.credits < needed) {
      throw new Error(
        `Batch needs ${needed} credits — account holds ${acct.credits}. Top up in Billing.`,
      );
    }

    const batchId = await ctx.db.insert("batches", {
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
        userId,
        delta: -CREDIT_COST,
        reason: `Batch ${name} — SKU ${row.sku}`,
        jobId,
        batchId,
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(acct._id, { credits: acct.credits - needed });

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
// Billing — credit packs and enterprise invoicing
// ---------------------------------------------------------------------------

export const CREDIT_PACKS = {
  starter: { credits: 200, priceCents: 1900, label: "Starter pack" },
  studio: { credits: 1000, priceCents: 7900, label: "Studio pack" },
  atelier: { credits: 5000, priceCents: 29900, label: "Atelier pack" },
} as const;

export const topUpCredits = mutation({
  args: { packId: v.string() },
  handler: async (ctx, { packId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const pack = CREDIT_PACKS[packId as keyof typeof CREDIT_PACKS];
    if (!pack) throw new Error("Unknown credit pack");

    const acct = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!acct) throw new Error("Account not found");

    await ctx.db.patch(acct._id, { credits: acct.credits + pack.credits });
    await ctx.db.insert("creditLedger", {
      userId,
      delta: pack.credits,
      reason: `Purchased ${pack.label}`,
      createdAt: Date.now(),
    });
    return { credits: acct.credits + pack.credits };
  },
});

export const listLedger = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("creditLedger")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const listInvoices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("invoices")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const settleInvoice = mutation({
  args: { invoiceId: v.id("invoices"), settledVia: v.string() },
  handler: async (ctx, { invoiceId, settledVia }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    if (inv.userId !== userId) throw new Error("Not your invoice");
    await ctx.db.patch(invoiceId, {
      status: "paid" as const,
      paidAt: Date.now(),
      settledVia,
    });
  },
});
