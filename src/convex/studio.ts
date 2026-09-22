import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  aestheticValidator,
  CREDIT_COST,
  engineUsedValidator,
  engineValidator,
  kindValidator,
} from "./engineConfig";

// ---------------------------------------------------------------------------
// Accounts & credits
// ---------------------------------------------------------------------------

export const getAccount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const acct = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (acct) return acct;
    return null;
  },
});

/** Create the free-tier account with welcome credits on first visit. */
export const bootstrapAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const acct = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (acct) return acct._id;
    const id = await ctx.db.insert("accounts", {
      userId,
      credits: 25,
      plan: "free",
      enterprise: false,
      createdAt: Date.now(),
    });
    await ctx.db.insert("creditLedger", {
      userId,
      delta: 25,
      reason: "Welcome credits",
      createdAt: Date.now(),
    });
    // Owner bootstrap: promote to admin when the account email is listed in
    // the ADMIN_EMAILS secret (comma-separated). Set it in the Keys tab.
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const user = await ctx.db.get(userId);
    if (user?.email && adminEmails.includes(user.email.toLowerCase())) {
      await ctx.db.patch(userId, { role: "admin" as const });
    }
    return id;
  },
});

// ---------------------------------------------------------------------------
// Assets — direct-to-storage ingestion registry
// ---------------------------------------------------------------------------

/** Direct client-to-storage upload: no server-side payload proxying. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const listAssets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const assets = await ctx.db
      .query("assets")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(120);
    return Promise.all(
      assets.map(async (a) => ({
        ...a,
        url: a.storageId ? ((await ctx.storage.getUrl(a.storageId)) ?? a.url ?? null) : (a.url ?? null),
      })),
    );
  },
});

export const registerAsset = mutation({
  args: {
    name: v.string(),
    kind: kindValidator,
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    mediaType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const id = await ctx.db.insert("assets", {
      userId,
      name: args.name,
      kind: args.kind,
      storageId: args.storageId,
      url: args.url,
      sizeBytes: args.sizeBytes,
      mediaType: args.mediaType,
      createdAt: Date.now(),
    });
    return id;
  },
});

// ---------------------------------------------------------------------------
// Jobs — single generation requests
// ---------------------------------------------------------------------------

export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("jobs")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(60);
  },
});

export const createJob = mutation({
  args: {
    garmentUrl: v.string(),
    modelUrl: v.optional(v.string()),
    engine: engineValidator,
    aesthetic: aestheticValidator,
    lighting: v.object({
      keyIntensity: v.number(),
      fillRatio: v.number(),
      warmth: v.number(),
    }),
    stylePrompt: v.optional(v.string()),
    sku: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const acct = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!acct) throw new Error("Account not found");
    if (acct.credits < CREDIT_COST) {
      throw new Error("Insufficient credits — top up in Billing.");
    }

    const jobId = await ctx.db.insert("jobs", {
      userId,
      sku: args.sku,
      garmentUrl: args.garmentUrl,
      modelUrl: args.modelUrl,
      engine: args.engine,
      aesthetic: args.aesthetic,
      lighting: args.lighting,
      stylePrompt: args.stylePrompt,
      status: "queued",
      costCredits: CREDIT_COST,
      createdAt: Date.now(),
    });

    // Reserve credits immediately; refunded on failure.
    await ctx.db.patch(acct._id, { credits: acct.credits - CREDIT_COST });
    await ctx.db.insert("creditLedger", {
      userId,
      delta: -CREDIT_COST,
      reason: "Generation queued",
      jobId,
      createdAt: Date.now(),
    });

    return jobId;
  },
});

// ---------------------------------------------------------------------------
// Storage — resolve Convex storage ids into serve URLs
// ---------------------------------------------------------------------------

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

// ---------------------------------------------------------------------------
// Worker — FIFO claim, completion, failure refunds
// ---------------------------------------------------------------------------

export const claimNextJobs = internalMutation({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const queued = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(limit);
    const claimed: Id<"jobs">[] = [];
    const now = Date.now();
    for (const job of queued) {
      await ctx.db.patch(job._id, {
        status: "processing" as const,
        startedAt: now,
      });
      claimed.push(job._id);
    }
    return claimed;
  },
});

export const completeJob = internalMutation({
  args: {
    jobId: v.id("jobs"),
    resultUrl: v.string(),
    engineUsed: engineUsedValidator,
  },
  handler: async (ctx, { jobId, resultUrl, engineUsed }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    await ctx.db.patch(jobId, {
      status: "done" as const,
      resultUrl,
      engineUsed,
      completedAt: Date.now(),
    });
    if (job.batchId) await bumpBatchProgress(ctx, job.batchId);
  },
});

export const failJob = internalMutation({
  args: { jobId: v.id("jobs"), error: v.string() },
  handler: async (ctx, { jobId, error }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    await ctx.db.patch(jobId, {
      status: "failed" as const,
      error,
      completedAt: Date.now(),
    });
    // Refund reserved credits on failure.
    const acct = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", job.userId))
      .unique();
    if (acct) {
      await ctx.db.patch(acct._id, { credits: acct.credits + job.costCredits });
      await ctx.db.insert("creditLedger", {
        userId: job.userId,
        delta: job.costCredits,
        reason: "Refund — generation failed",
        jobId,
        createdAt: Date.now(),
      });
    }
    if (job.batchId) await bumpBatchProgress(ctx, job.batchId);
  },
});

async function bumpBatchProgress(
  ctx: { db: any },
  batchId: Id<"batches">,
) {
  const batch = await ctx.db.get(batchId);
  if (!batch) return;
  const processedRows = batch.processedRows + 1;
  const done = processedRows >= batch.totalRows;
  await ctx.db.patch(batchId, {
    processedRows,
    status: done ? ("done" as const) : ("running" as const),
  });
}

// ---------------------------------------------------------------------------
// Worker loop — pulls claimed jobs through the generation pipeline
// ---------------------------------------------------------------------------

export const runWorker = internalAction({
  args: {},
  handler: async (ctx) => {
    const jobIds: Id<"jobs">[] = await ctx.runMutation(
      internal.studio.claimNextJobs,
      { limit: 4 },
    );
    if (jobIds.length === 0) return { processed: 0 };

    for (const jobId of jobIds) {
      const job = await ctx.runQuery(internal.studio.getJobInternal, { jobId });
      if (!job || job.status !== "processing") continue;
      try {
        const result = await generateWithFallback(ctx, job);
        await ctx.runMutation(internal.studio.completeJob, {
          jobId,
          resultUrl: result.url,
          engineUsed: result.engineUsed,
        });
      } catch (err) {
        await ctx.runMutation(internal.studio.failJob, {
          jobId,
          error: err instanceof Error ? err.message : "Generation failed",
        });
      }
    }
    return { processed: jobIds.length };
  },
});

export const getJobInternal = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => await ctx.db.get(jobId),
});

/**
 * Kick the background worker. Called after every enqueue so the pipeline
 * drains asynchronously without blocking or timing out the web client.
 */
export const kickWorker = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.studio.runWorker, {});
    return true;
  },
});

// ---------------------------------------------------------------------------
// Enterprise invoicing — net-30 corporate settlement
// ---------------------------------------------------------------------------

export const issueInvoice = mutation({
  args: {
    periodLabel: v.string(),
    generationCount: v.number(),
    amountCents: v.number(),
  },
  handler: async (ctx, { periodLabel, generationCount, amountCents }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const acct = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!acct) throw new Error("Account not found");
    if (!acct.enterprise) {
      throw new Error("Enterprise invoicing requires a wholesale account.");
    }
    const number = `LXM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const dueAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // net-30
    const id = await ctx.db.insert("invoices", {
      userId,
      number,
      periodLabel,
      generationCount,
      amountCents,
      status: "open",
      dueAt,
      createdAt: Date.now(),
    });
    return id;
  },
});

// ---------------------------------------------------------------------------
// Generation pipeline — primary engines with CatVTON-style circuit breaker
// ---------------------------------------------------------------------------

async function generateWithFallback(
  ctx: any,
  job: any,
): Promise<{ url: string; engineUsed: "catalog" | "campaign" | "fallback" }> {
  const { callGenerationEngine } = await import("./generation");
  return callGenerationEngine(ctx, job);
}
