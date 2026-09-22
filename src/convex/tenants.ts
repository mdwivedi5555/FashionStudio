import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Tenant resolution & membership.
 *
 * Every user gets a personal tenant automatically (their own studio with its
 * own credit pool). Admins can create organization tenants and add members;
 * members share the tenant's credits, assets, queue, and gallery, but each
 * user can switch which tenant workspace they are currently in.
 */

const WELCOME_CREDITS = 25;

/**
 * Read-only tenant resolution for QUERIES. Never writes.
 * Returns null when the user has no tenant yet — the UI bootstraps via
 * bootstrapAccount (a mutation) in that case.
 */
export async function resolveTenantRead(
  ctx: QueryCtx,
): Promise<{ tenant: Doc<"tenants">; userId: Id<"users">; membershipRole: "owner" | "member" } | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const user = await ctx.db.get(userId);
  if (user?.activeTenantId) {
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("tenantId"), user.activeTenantId))
      .unique();
    const tenant = membership ? await ctx.db.get(user.activeTenantId) : null;
    if (membership && tenant) {
      return { tenant, userId, membershipRole: membership.role as "owner" | "member" };
    }
  }

  // Fallback: the user's personal tenant, if it exists already.
  const memberships = await ctx.db
    .query("tenantMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const m of memberships) {
    const t = await ctx.db.get(m.tenantId);
    if (t && t.kind === "personal") {
      return { tenant: t, userId, membershipRole: m.role as "owner" | "member" };
    }
  }
  return null;
}

/** Resolve the user's active tenant, bootstrapping a personal one if needed. */
export async function requireTenant(
  ctx: MutationCtx,
): Promise<{ tenant: Doc<"tenants">; userId: Id<"users">; membershipRole: "owner" | "member" }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const user = await ctx.db.get(userId);

  // 1. Explicit active tenant (must be a member).
  if (user?.activeTenantId) {
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("tenantId"), user.activeTenantId))
      .unique();
    const tenant = membership
      ? await ctx.db.get(user.activeTenantId)
      : null;
    if (membership && tenant) {
      return {
        tenant,
        userId,
        membershipRole: membership.role as "owner" | "member",
      };
    }
    // Stale pointer (e.g. membership revoked) — fall through to bootstrap.
  }

  // 2. Bootstrap: find or create the user's personal tenant.
  const memberships = await ctx.db
    .query("tenantMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  for (const m of memberships) {
    const t = await ctx.db.get(m.tenantId);
    if (t && t.kind === "personal") {
      await ctx.db.patch(userId, { activeTenantId: t._id });
      return { tenant: t, userId, membershipRole: m.role as "owner" | "member" };
    }
  }

  const user2 = user ?? (await ctx.db.get(userId));
  const slug = `personal-${userId.slice(-12)}`;
  const tenantId = await ctx.db.insert("tenants", {
    name: user2?.name || user2?.email || "My Studio",
    slug,
    kind: "personal",
    credits: WELCOME_CREDITS,
    plan: "free",
    enterprise: false,
    createdBy: userId,
    createdAt: Date.now(),
  });
  await ctx.db.insert("tenantMembers", {
    tenantId,
    userId,
    role: "owner",
    createdAt: Date.now(),
  });
  await ctx.db.insert("creditLedger", {
    tenantId,
    userId,
    delta: WELCOME_CREDITS,
    reason: "Welcome credits",
    createdAt: Date.now(),
  });
  await ctx.db.patch(userId, { activeTenantId: tenantId });

  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new Error("Tenant bootstrap failed");
  return { tenant, userId, membershipRole: "owner" };
}

/** Ensure a personal tenant exists without returning heavy data (for bootstrap calls). */
export const bootstrapTenant = mutation({
  args: {},
  handler: async (ctx) => {
    const { tenant } = await requireTenant(ctx);
    return tenant._id;
  },
});

/** Current tenant + the caller's membership role. */
export const getCurrentTenant = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user?.activeTenantId) return null;
    const tenant = await ctx.db.get(user.activeTenantId);
    if (!tenant) return null;
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    return {
      _id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      kind: tenant.kind,
      credits: tenant.credits,
      plan: tenant.plan,
      enterprise: tenant.enterprise,
      membershipRole: (membership?.role ?? "member") as "owner" | "member",
    };
  },
});

/** All tenants the user belongs to (for the workspace switcher). */
export const listMyTenants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("tenantMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return Promise.all(
      memberships.map(async (m) => {
        const t = await ctx.db.get(m.tenantId);
        if (!t) return null;
        return {
          _id: t._id,
          name: t.name,
          kind: t.kind,
          plan: t.plan,
          credits: t.credits,
          membershipRole: m.role as "owner" | "member",
        };
      }),
    ).then((list) => list.filter((x): x is NonNullable<typeof x> => x !== null));
  },
});

/** Switch the active workspace. Must be a member of the target tenant. */
export const switchTenant = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("tenantId"), tenantId))
      .unique();
    if (!membership) throw new Error("You are not a member of that workspace");
    await ctx.db.patch(userId, { activeTenantId: tenantId });
    return true;
  },
});
