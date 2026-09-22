import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // Multi-tenant: which tenant's workspace the user is currently in.
      activeTenantId: v.optional(v.id("tenants")),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ------------------------------------------------------------------
    // LUXEMEE STUDIO — Tenants (organizations / brands / agencies)
    // ------------------------------------------------------------------

    // A tenant owns its credits, plan, and all studio content.
    tenants: defineTable({
      name: v.string(),
      slug: v.string(),
      // "personal" tenants are auto-created per user; org tenants by admins.
      kind: v.union(v.literal("personal"), v.literal("organization")),
      credits: v.number(),
      plan: v.union(
        v.literal("free"),
        v.literal("studio"),
        v.literal("enterprise"),
      ),
      enterprise: v.boolean(),
      billingEmail: v.optional(v.string()),
      createdBy: v.optional(v.id("users")),
      createdAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_created", ["createdAt"]),

    // Membership: a user can belong to multiple tenants (org membership is
    // granted by an admin); personal tenants have exactly one owner.
    tenantMembers: defineTable({
      tenantId: v.id("tenants"),
      userId: v.id("users"),
      role: v.union(v.literal("owner"), v.literal("member")),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_tenant", ["tenantId"]),

    // ------------------------------------------------------------------
    // LUXEMEE STUDIO — Phase 1 domain tables (tenant-scoped)
    // ------------------------------------------------------------------

    // Ingested source assets: flat-lays, mannequins, model faces, 3D renders.
    assets: defineTable({
      tenantId: v.id("tenants"),
      userId: v.id("users"), // who uploaded
      name: v.string(),
      kind: v.union(
        v.literal("flatlay"),
        v.literal("mannequin"),
        v.literal("model_face"),
        v.literal("render_3d"),
      ),
      // Either a Convex storage id (direct client upload) or an external URL.
      storageId: v.optional(v.id("_storage")),
      url: v.optional(v.string()),
      sizeBytes: v.optional(v.number()),
      mediaType: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_tenant_created", ["tenantId", "createdAt"])
      .index("by_user", ["userId"]),

    // Async generation queue (bulk + single).
    jobs: defineTable({
      tenantId: v.id("tenants"),
      userId: v.id("users"), // who queued it
      batchId: v.optional(v.id("batches")),
      sku: v.optional(v.string()),
      garmentUrl: v.string(),
      modelUrl: v.optional(v.string()),
      engine: v.union(
        v.literal("catalog"), // FASHN-style e-commerce mode
        v.literal("campaign"), // FLUX-style stylized mode
      ),
      engineUsed: v.optional(
        v.union(
          v.literal("catalog"),
          v.literal("campaign"),
          v.literal("fallback"), // CatVTON-style circuit breaker
        ),
      ),
      aesthetic: v.union(
        v.literal("standard"),
        v.literal("prompt_pulse"), // vintage editorial poster override
      ),
      lighting: v.object({
        keyIntensity: v.number(), // 0..100
        fillRatio: v.number(), // 1..6 => "fill ratio N:1"
        warmth: v.number(), // 0..100
      }),
      stylePrompt: v.optional(v.string()),
      status: v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("done"),
        v.literal("failed"),
      ),
      resultUrl: v.optional(v.string()),
      error: v.optional(v.string()),
      costCredits: v.number(),
      createdAt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
    })
      .index("by_tenant_created", ["tenantId", "createdAt"])
      .index("by_status", ["status", "createdAt"]) // FIFO worker claim
      .index("by_batch", ["batchId"]),

    // Bulk CSV import runs.
    batches: defineTable({
      tenantId: v.id("tenants"),
      userId: v.id("users"),
      name: v.string(),
      engine: v.union(v.literal("catalog"), v.literal("campaign")),
      aesthetic: v.union(v.literal("standard"), v.literal("prompt_pulse")),
      totalRows: v.number(),
      processedRows: v.number(),
      failedRows: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("done"),
      ),
      createdAt: v.number(),
    }).index("by_tenant_created", ["tenantId", "createdAt"]),

    // Credit ledger — every deduction and top-up is traceable, per tenant.
    creditLedger: defineTable({
      tenantId: v.id("tenants"),
      userId: v.id("users"), // who performed the action
      delta: v.number(), // negative = spend, positive = top-up/refund
      reason: v.string(),
      jobId: v.optional(v.id("jobs")),
      batchId: v.optional(v.id("batches")),
      createdAt: v.number(),
    }).index("by_tenant_created", ["tenantId", "createdAt"]),

    // Enterprise net-30 invoicing portal — issued against a tenant.
    invoices: defineTable({
      tenantId: v.id("tenants"),
      userId: v.id("users"), // who issued it
      number: v.string(),
      periodLabel: v.string(),
      generationCount: v.number(),
      amountCents: v.number(),
      status: v.union(v.literal("open"), v.literal("paid")),
      dueAt: v.number(),
      paidAt: v.optional(v.number()),
      settledVia: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_tenant_created", ["tenantId", "createdAt"])
      .index("by_tenant_status", ["tenantId", "status"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
