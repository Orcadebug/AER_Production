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
    }).index("email", ["email"]),

    // Projects for organizing contexts
    projects: defineTable({
      userId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      color: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    // Tags for categorization
    tags: defineTable({
      userId: v.id("users"),
      name: v.string(),
      color: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    // Main context/notes table
    contexts: defineTable({
      userId: v.id("users"),
      projectId: v.optional(v.id("projects")),
      title: v.string(),
      content: v.string(),
      summary: v.optional(v.string()),
      type: v.union(v.literal("note"), v.literal("file"), v.literal("web")),
      fileId: v.optional(v.id("_storage")),
      fileName: v.optional(v.string()),
      fileType: v.optional(v.string()),
      url: v.optional(v.string()),
      tagIds: v.optional(v.array(v.id("tags"))),
    })
      .index("by_user", ["userId"])
      .index("by_project", ["projectId"])
      .searchIndex("search_content", {
        searchField: "content",
        filterFields: ["userId"],
      }),
  },
  {
    schemaValidation: false,
  },
);

export default schema;