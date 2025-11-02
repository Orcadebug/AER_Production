import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Internal mutation to create a context for a specific user (bypasses auth)
 */
export const createForUser = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    type: v.optional(v.union(v.literal("note"), v.literal("file"), v.literal("web"))),
    projectId: v.optional(v.id("projects")),
    tagIds: v.optional(v.array(v.id("tags"))),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    url: v.optional(v.string()),
    encryptedContent: v.optional(v.object({ ciphertext: v.string(), nonce: v.string() })),
    encryptedTitle: v.optional(v.object({ ciphertext: v.string(), nonce: v.string() })),
    encryptedSummary: v.optional(v.object({ ciphertext: v.string(), nonce: v.string() })),
    encryptedMetadata: v.optional(v.object({ ciphertext: v.string(), nonce: v.string() })),
    plaintextContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Fallback envelopes if only plaintext provided
    const encContent =
      args.encryptedContent ??
      (args.plaintextContent
        ? { ciphertext: args.plaintextContent, nonce: "plain" }
        : null);

    if (!encContent) {
      throw new Error("Missing encrypted content");
    }

    const encTitle =
      args.encryptedTitle ??
      (args.title ? { ciphertext: args.title, nonce: "plain" } : undefined);

    const generatedSummary =
      args.plaintextContent
        ? (args.plaintextContent.length > 200
            ? args.plaintextContent.slice(0, 200).trim() + "..."
            : args.plaintextContent.trim())
        : undefined;

    const encSummary =
      args.encryptedSummary ??
      (generatedSummary ? { ciphertext: generatedSummary, nonce: "plain" } : undefined);

    const contextId = await ctx.db.insert("contexts", {
      userId: args.userId,
      title: args.title,
      type: (args.type as any) || "note",
      projectId: args.projectId,
      tagIds: args.tagIds,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      url: args.url,
      encryptedContent: encContent,
      encryptedTitle: encTitle,
      encryptedSummary: encSummary,
      encryptedMetadata: args.encryptedMetadata,
    });

    // Compute user's total contexts for tag granularity
    const totalContexts = await ctx.db
      .query("contexts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((cs) => cs.length);

    // Schedule AI enrichment if plaintext available
    if (args.plaintextContent && process.env.PERPLEXITY_API_KEY) {
      await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateTags, {
        userId: args.userId,
        contextId,
        content: args.plaintextContent,
        title: args.title,
        totalContexts,
      });
      await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateSummary, {
        userId: args.userId,
        contextId,
        content: args.plaintextContent,
        title: args.title,
      });

      await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateTitleAndProject, {
        userId: args.userId,
        contextId,
        content: args.plaintextContent,
        currentTitle: args.title,
      });
    }

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
export const updateSummary = internalMutation({
  args: {
    contextId: v.id("contexts"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contextId, {
      encryptedSummary: { ciphertext: args.summary, nonce: "plain" },
    });
  },
});

/**
 * Internal mutation to update title on a context (also updates encryptedTitle envelope)
 */
export const updateTitle = internalMutation({
  args: {
    contextId: v.id("contexts"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contextId, {
      title: args.title,
      encryptedTitle: { ciphertext: args.title, nonce: "plain" },
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