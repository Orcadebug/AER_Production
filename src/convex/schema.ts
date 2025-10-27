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
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      // Encryption key metadata (not the actual key - stored client-side only)
      encryptionKeyVersion: v.optional(v.number()),
      lastKeyRotation: v.optional(v.number()),
    }).index("email", ["email"]),

    // Projects for organizing contexts
    projects: defineTable({
      userId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      color: v.optional(v.string()),
      // Encrypted fields
      encryptedName: v.optional(v.object({
        ciphertext: v.string(),
        nonce: v.string(),
      })),
      encryptedDescription: v.optional(v.object({
        ciphertext: v.string(),
        nonce: v.string(),
      })),
    }).index("by_user", ["userId"]),

    // Tags for categorization
    tags: defineTable({
      userId: v.id("users"),
      name: v.string(),
      color: v.optional(v.string()),
      // Encrypted fields
      encryptedName: v.optional(v.object({
        ciphertext: v.string(),
        nonce: v.string(),
      })),
    }).index("by_user", ["userId"]),

    // Main context/notes table with E2E encryption
    contexts: defineTable({
      userId: v.id("users"),
      projectId: v.optional(v.id("projects")),
      // Plaintext fields for indexing/search (minimal metadata)
      title: v.string(),
      type: v.union(v.literal("note"), v.literal("file"), v.literal("web")),
      // Encrypted fields (actual content)
      encryptedContent: v.object({
        ciphertext: v.string(),
        nonce: v.string(),
      }),
      encryptedTitle: v.optional(v.object({
        ciphertext: v.string(),
        nonce: v.string(),
      })),
      encryptedSummary: v.optional(v.object({
        ciphertext: v.string(),
        nonce: v.string(),
      })),
      encryptedMetadata: v.optional(v.object({
        ciphertext: v.string(),
        nonce: v.string(),
      })),
      // File storage (files themselves are not encrypted in Convex storage)
      fileId: v.optional(v.id("_storage")),
      fileName: v.optional(v.string()),
      fileType: v.optional(v.string()),
      url: v.optional(v.string()),
      tagIds: v.optional(v.array(v.id("tags"))),
    })
      .index("by_user", ["userId"])
      .index("by_project", ["projectId"])
      .searchIndex("search_content", {
        searchField: "title",
        filterFields: ["userId"],
      }),

    // Audit log for encryption events
    auditLog: defineTable({
      userId: v.id("users"),
      action: v.string(),
      resourceType: v.string(),
      resourceId: v.optional(v.string()),
      timestamp: v.number(),
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      success: v.boolean(),
      errorMessage: v.optional(v.string()),
    })
      .index("by_user", ["userId"])
      .index("by_timestamp", ["timestamp"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;