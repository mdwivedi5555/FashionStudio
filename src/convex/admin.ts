import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";

/**
 * Owner / developer admin console backend — multi-tenant.
 * Every function verifies the caller holds the "admin" role before
 * returning or mutating anything. Admins manage tenants (organizations),
 * memberships, tenant credit pools, and enterprise invoicing.
 */

async function requireAdmin(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Forbidden — admin access required");
  }
  return { userId, user };
}

// ---------------------------------------------------------------------------
// Caller identity (used by the admin page & route guard)
// ---------------------------------------------------------------------------

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { role: user.role ?? "user" };
  },
});

// ---------------------------------------------------------------------------
// Platform stats (tenant-aware)
// ---------------------------------------------------------------------------

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [users, tenants, memberships, jobs, batches, invoices, ledger] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("tenants").collect(),
        ctx.db.query("tenantMembers").collect(),
        ctx.db.query("jobs").collect(),
        ctx.db.query("batches").collect(),
        ctx.db.query("invoices").collect(),
        ctx.db.query("creditLedger").collect(),
      ]);

    const done = jobs.filter((j) => j.status === "done").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const active = jobs.filter(
      (j) => j.status === "queued" || j.status === "processing",
    ).length;

    return {
      totalUsers: users.length,
      totalTenants: tenants.length,
      orgTenants: tenants.filter((t) => t.kind === "organization").length,
      personalTenants: tenants.filter((t) => t.kind === "personal").length,
      totalMemberships: memberships.length,
      enterpriseTenants: tenants.filter((t) => t.enterprise).length,
      totalJobs: jobs.length,
      doneJobs: done,
      failedJobs: failed,
      activeJobs: active,
      failureRatePct: jobs.length > 0 ? Math.round((failed / jobs.length) * 100) : 0,
      totalBatches: batches.length,
      creditsInCirculation: ledger.reduce((sum, l) => sum + l.delta, 0),
      revenueCents: invoices
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + i.amountCents, 0),
      outstandingCents: invoices
        .filter((i) => i.status === "open")
        .reduce((sum, i) => sum + i.amountCents, 0),
      openInvoices: invoices.filter((i) => i.status === "open").length,
    };
  },
});

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export const listTenants = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tenants = await ctx.db.query("tenants").order("desc").take(200);
    const memberships = await ctx.db.query("tenantMembers").collect();
    const jobs = await ctx.db.query("jobs").collect();
    const users = await ctx.db.query("users").collect();

    return tenants.map((t) => {
      const members = memberships
        .filter((m) => m.tenantId === t._id)
        .map((m) => {
          const u = users.find((x) => x._id === m.userId);
          return {
            userId: m.userId,
            role: m.role,
            email: u?.email ?? (u?.isAnonymous ? "guest" : "unknown"),
          };
        });
      return {
        _id: t._id,
        name: t.name,
        slug: t.slug,
        kind: t.kind,
        credits: t.credits,
        plan: t.plan,
        enterprise: t.enterprise,
        memberCount: members.length,
        members,
        jobCount: jobs.filter((j) => j.tenantId === t._id).length,
        createdAt: t.createdAt,
      };
    });
  },
});

export const createTenant = mutation({
  args: {
    name: v.string(),
    kind: v.union(v.literal("personal"), v.literal("organization")),
    credits: v.optional(v.number()),
    enterprise: v.optional(v.boolean()),
  },
  handler: async (ctx, { name, kind, credits, enterprise }) => {
    const { userId } = await requireAdmin(ctx);
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const slug = `${base || "tenant"}-${Math.random().toString(36).slice(2, 6)}`;
    const tenantId = await ctx.db.insert("tenants", {
      name: name.trim(),
      slug,
      kind,
      credits: credits ?? 0,
      plan: enterprise ? "enterprise" : "free",
      enterprise: enterprise ?? false,
      createdBy: userId,
      createdAt: Date.now(),
    });
    return tenantId;
  },
});

export const addTenantMember = mutation({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
  },
  handler: async (ctx, { tenantId, email, role }) => {
    await requireAdmin(ctx);
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new Error("Tenant not found");

    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.trim().toLowerCase()))
      .unique();
    if (!target) {
      throw new Error(`No registered user with email ${email} — they must sign up first.`);
    }

    const existing = await ctx.db
      .query("tenantMembers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .filter((q) => q.eq(q.field("userId"), target._id))
      .unique();
    if (existing) throw new Error("User is already a member of this tenant");

    await ctx.db.insert("tenantMembers", {
      tenantId,
      userId: target._id,
      role,
      createdAt: Date.now(),
    });
    return true;
  },
});

export const removeTenantMember = mutation({
  args: { tenantId: v.id("tenants"), userId: v.id("users") },
  handler: async (ctx, { tenantId, userId }) => {
    await requireAdmin(ctx);
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!membership) throw new Error("Membership not found");
    await ctx.db.delete(membership._id);

    // If their active workspace was this tenant, point them home.
    const user = await ctx.db.get(userId);
    if (user?.activeTenantId === tenantId) {
      const remaining = await ctx.db
        .query("tenantMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const fallback = remaining[0]?.tenantId;
      if (fallback) {
        await ctx.db.patch(userId, { activeTenantId: fallback });
      } else {
        await ctx.db.patch(userId, { activeTenantId: undefined });
      }
    }
    return true;
  },
});

export const grantTenantCredits = mutation({
  args: { tenantId: v.id("tenants"), amount: v.number(), reason: v.string() },
  handler: async (ctx, { tenantId, amount, reason }) => {
    const { userId: adminId } = await requireAdmin(ctx);
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new Error("Tenant not found");
    await ctx.db.patch(tenantId, { credits: tenant.credits + amount });
    await ctx.db.insert("creditLedger", {
      tenantId,
      userId: adminId,
      delta: amount,
      reason: `Admin grant — ${reason}`,
      createdAt: Date.now(),
    });
  },
});

export const setTenantEnterprise = mutation({
  args: { tenantId: v.id("tenants"), enterprise: v.boolean() },
  handler: async (ctx, { tenantId, enterprise }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(tenantId, {
      enterprise,
      plan: enterprise ? "enterprise" : "free",
    });
  },
});

// ---------------------------------------------------------------------------
// Users (read-only roster + platform role management)
// ---------------------------------------------------------------------------

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").take(200);
    const memberships = await ctx.db.query("tenantMembers").collect();
    const tenants = await ctx.db.query("tenants").collect();

    return users.map((u) => {
      const myMemberships = memberships
        .filter((m) => m.userId === u._id)
        .map((m) => {
          const t = tenants.find((x) => x._id === m.tenantId);
          return t ? { tenantId: m.tenantId, name: t.name, role: m.role } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return {
        _id: u._id,
        email: u.email ?? null,
        name: u.name ?? null,
        role: u.role ?? "user",
        isAnonymous: u.isAnonymous ?? false,
        tenants: myMemberships,
      };
    });
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("user"), v.literal("member")),
  },
  handler: async (ctx, { userId, role }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(userId, { role });
  },
});

// ---------------------------------------------------------------------------
// Renders oversight
// ---------------------------------------------------------------------------

export const listRecentJobs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const jobs = await ctx.db.query("jobs").order("desc").take(50);
    const users = await ctx.db.query("users").collect();
    const tenants = await ctx.db.query("tenants").collect();
    return jobs.map((j) => {
      const u = users.find((x) => x._id === j.userId);
      const t = tenants.find((x) => x._id === j.tenantId);
      return {
        _id: j._id,
        email: u?.email ?? (u?.isAnonymous ? "guest" : "unknown"),
        tenantName: t?.name ?? "unknown",
        sku: j.sku ?? null,
        engine: j.engine,
        engineUsed: j.engineUsed ?? null,
        aesthetic: j.aesthetic,
        status: j.status,
        error: j.error ?? null,
        costCredits: j.costCredits,
        createdAt: j.createdAt,
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
    const tenants = await ctx.db.query("tenants").collect();
    return invoices.map((i) => {
      const t = tenants.find((x) => x._id === i.tenantId);
      return {
        _id: i._id,
        number: i.number,
        tenantName: t?.name ?? "unknown",
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
