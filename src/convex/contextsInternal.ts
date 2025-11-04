import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Internal mutation to create a context for a specific user (bypasses auth)
 */
export const createForUser = internalMutation({
  args: {
    userId: v.id("users"),
    // Legacy optional fields (ignored server-side)
    title: v.optional(v.string()),
    type: v.optional(v.union(v.literal("note"), v.literal("file"), v.literal("web"))),
    plaintextContent: v.optional(v.string()),
    // Current args
    projectId: v.optional(v.id("projects")),
    tagIds: v.optional(v.array(v.id("tags"))),
    tags: v.optional(v.array(v.string())),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    url: v.optional(v.string()),
    encryptedContent: v.object({ ciphertext: v.string(), nonce: v.string() }),
    encryptedTitle: v.optional(v.object({ ciphertext: v.string(), nonce: v.string() })),
    encryptedSummary: v.optional(v.object({ ciphertext: v.string(), nonce: v.string() })),
    encryptedMetadata: v.optional(v.object({ ciphertext: v.string(), nonce: v.string() })),
  },
  handler: async (ctx, args) => {
    // Enforce E2E: require encrypted content, no server-side fallbacks
    if (!args.encryptedContent?.ciphertext || !args.encryptedContent?.nonce) {
      throw new Error("Missing encrypted content");
    }

    const contextId = await ctx.db.insert("contexts", {
      userId: args.userId,
      projectId: args.projectId,
      tagIds: args.tagIds,
      tags: args.tags,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      url: args.url,
      encryptedContent: args.encryptedContent,
      encryptedTitle: args.encryptedTitle,
      encryptedSummary: args.encryptedSummary,
      encryptedMetadata: args.encryptedMetadata,
    });

    // Audit
    await ctx.scheduler.runAfter(0, internal.audit.logAuditEvent, {
      userId: args.userId,
      action: "CREATE_CONTEXT_HTTP",
      resourceType: "context",
      resourceId: contextId,
      success: true,
    });

    return contextId;
  },
});

/**
 * Internal mutation to update tags on a context
 */
export const updateTags = internalMutation({
  args: {
    contextId: v.id("contexts"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contextId, {
      tags: args.tags,
    });
  },
});

/**
 * Internal mutation to update summary on a context
 */
export const updateEncryptedSummary = internalMutation({
  args: {
    contextId: v.id("contexts"),
    encryptedSummary: v.object({ ciphertext: v.string(), nonce: v.string() }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contextId, {
      encryptedSummary: args.encryptedSummary,
    });
  },
});

/**
 * Internal mutation to update title on a context (also updates encryptedTitle envelope)
 */
export const updateEncryptedTitle = internalMutation({
  args: {
    contextId: v.id("contexts"),
    encryptedTitle: v.object({ ciphertext: v.string(), nonce: v.string() }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contextId, {
      encryptedTitle: args.encryptedTitle,
    });
  },
});

/**
 * Internal mutation to update project assignment for a context
 */
export const updateProject = internalMutation({
  args: {
    contextId: v.id("contexts"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contextId, {
      projectId: args.projectId,
    });
  },
});

/**
 * Internal query to get all contexts for a user
 */
export const getAllContextsForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contexts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});