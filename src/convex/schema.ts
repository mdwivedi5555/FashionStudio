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
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ------------------------------------------------------------------
    // LUXEMEE STUDIO — Phase 1 domain tables
    // ------------------------------------------------------------------

    // One billing account per user: credits + plan tier.
    accounts: defineTable({
      userId: v.id("users"),
      credits: v.number(),
      plan: v.union(
        v.literal("free"),
        v.literal("studio"),
        v.literal("enterprise"),
      ),
      enterprise: v.boolean(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // Ingested source assets: flat-lays, mannequins, model faces, 3D renders.
    assets: defineTable({
      userId: v.id("users"),
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
      .index("by_user", ["userId"])
      .index("by_user_created", ["userId", "createdAt"]),

    // Async generation queue (bulk + single).
    jobs: defineTable({
      userId: v.id("users"),
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
      .index("by_user_created", ["userId", "createdAt"])
      .index("by_status", ["status", "createdAt"]) // FIFO worker claim
      .index("by_batch", ["batchId"]),

    // Bulk CSV import runs.
    batches: defineTable({
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
    }).index("by_user_created", ["userId", "createdAt"]),

    // Credit ledger — every deduction and top-up is traceable.
    creditLedger: defineTable({
      userId: v.id("users"),
      delta: v.number(), // negative = spend, positive = top-up/refund
      reason: v.string(),
      jobId: v.optional(v.id("jobs")),
      batchId: v.optional(v.id("batches")),
      createdAt: v.number(),
    }).index("by_user_created", ["userId", "createdAt"]),

    // Enterprise net-30 invoicing portal.
    invoices: defineTable({
      userId: v.id("users"),
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
      .index("by_user_created", ["userId", "createdAt"])
      .index("by_user_status", ["userId", "status"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
