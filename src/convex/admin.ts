import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";

/**
 * Owner / developer admin panel backend.
 * Every function verifies the caller holds the "admin" role before
 * returning or mutating anything — RLS-equivalent isolation at the
 * function boundary.
 */

async function requireAdmin(ctx: QueryCtx): Promise<{ userId: any; user: any }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Forbidden — admin access required");
  }
  return { userId, user };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [users, accounts, jobs, batches, invoices, ledger] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("accounts").collect(),
      ctx.db.query("jobs").collect(),
      ctx.db.query("batches").collect(),
      ctx.db.query("invoices").collect(),
      ctx.db.query("creditLedger").collect(),
    ]);

    const done = jobs.filter((j: any) => j.status === "done").length;
    const failed = jobs.filter((j: any) => j.status === "failed").length;
    const active = jobs.filter(
      (j: any) => j.status === "queued" || j.status === "processing",
    ).length;

    // Sum of all credit deltas ever = credits currently circulating.
    const creditsInCirculation = ledger.reduce(
      (sum: number, l: any) => sum + l.delta,
      0,
    );

    const revenueCents = invoices
      .filter((i: any) => i.status === "paid")
      .reduce((sum: number, i: any) => sum + i.amountCents, 0);
    const outstandingCents = invoices
      .filter((i: any) => i.status === "open")
      .reduce((sum: number, i: any) => sum + i.amountCents, 0);

    return {
      totalUsers: users.length,
      totalAccounts: accounts.length,
      enterpriseAccounts: accounts.filter((a: any) => a.enterprise).length,
      totalJobs: jobs.length,
      doneJobs: done,
      failedJobs: failed,
      activeJobs: active,
      failureRatePct: jobs.length > 0 ? Math.round((failed / jobs.length) * 100) : 0,
      totalBatches: batches.length,
      creditsInCirculation,
      revenueCents,
      outstandingCents,
      openInvoices: invoices.filter((i: any) => i.status === "open").length,
    };
  },
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").take(200);
    const accounts = await ctx.db.query("accounts").collect();
    const jobs = await ctx.db.query("jobs").collect();

    return Promise.all(
      users.map(async (u: any) => {
        const acct = accounts.find((a: any) => a.userId === u._id);
        const userJobs = jobs.filter((j: any) => j.userId === u._id);
        return {
          _id: u._id,
          email: u.email ?? null,
          name: u.name ?? null,
          role: u.role ?? "user",
          isAnonymous: u.isAnonymous ?? false,
          credits: acct?.credits ?? 0,
          plan: acct?.plan ?? "free",
          enterprise: acct?.enterprise ?? false,
          jobCount: userJobs.length,
          failedCount: userJobs.filter((j: any) => j.status === "failed").length,
        };
      }),
    );
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("user"), v.literal("member")) },
  handler: async (ctx, { userId, role }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(userId, { role });
  },
});

export const grantCredits = mutation({
  args: { userId: v.id("users"), amount: v.number(), reason: v.string() },
  handler: async (ctx, { userId, amount, reason }) => {
    await requireAdmin(ctx);
    const acct = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!acct) throw new Error("User has no account yet");
    await ctx.db.patch(acct._id, { credits: acct.credits + amount });
    await ctx.db.insert("creditLedger", {
      userId,
      delta: amount,
      reason: `Admin grant — ${reason}`,
      createdAt: Date.now(),
    });
  },
});

export const setEnterpriseFlag = mutation({
  args: { userId: v.id("users"), enterprise: v.boolean() },
  handler: async (ctx, { userId, enterprise }) => {
    await requireAdmin(ctx);
    const acct = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!acct) throw new Error("User has no account yet");
    await ctx.db.patch(acct._id, {
      enterprise,
      plan: enterprise ? ("enterprise" as const) : ("free" as const),
    });
  },
});

// ---------------------------------------------------------------------------
// Renders / jobs oversight
// ---------------------------------------------------------------------------

export const listRecentJobs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const jobs = await ctx.db.query("jobs").order("desc").take(50);
    const users = await ctx.db.query("users").collect();
    return jobs.map((j: any) => {
      const u = users.find((x: any) => x._id === j.userId);
      return {
        _id: j._id,
        email: u?.email ?? (u?.isAnonymous ? "guest" : "unknown"),
        sku: j.sku ?? null,
        engine: j.engine,
        engineUsed: j.engineUsed ?? null,
        aesthetic: j.aesthetic,
        status: j.status,
        error: j.error ?? null,
        costCredits: j.costCredits,
        createdAt: j.createdAt,
        batchId: j.batchId ?? null,
      };
    });
  },
});

// ---------------------------------------------------------------------------
// Invoice oversight
// ---------------------------------------------------------------------------

export const listAllInvoices = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const invoices = await ctx.db.query("invoices").order("desc").take(100);
    const users = await ctx.db.query("users").collect();
    return invoices.map((i: any) => {
      const u = users.find((x: any) => x._id === i.userId);
      return {
        _id: i._id,
        number: i.number,
        email: u?.email ?? (u?.isAnonymous ? "guest" : "unknown"),
        periodLabel: i.periodLabel,
        generationCount: i.generationCount,
        amountCents: i.amountCents,
        status: i.status,
        dueAt: i.dueAt,
        settledVia: i.settledVia ?? null,
      };
    });
  },
});

export const markInvoicePaid = mutation({
  args: { invoiceId: v.id("invoices"), settledVia: v.string() },
  handler: async (ctx, { invoiceId, settledVia }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(invoiceId, {
      status: "paid" as const,
      paidAt: Date.now(),
      settledVia,
    });
  },
});
