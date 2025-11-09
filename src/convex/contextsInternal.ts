import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { serverEncryptString } from "./crypto";

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

    // Compute plaintext title for indexing/search
    const computedTitle = (() => {
      if ((args as any).title && typeof (args as any).title === "string") return ((args as any).title as string).slice(0, 80);
      if (args.fileName) return args.fileName.slice(0, 80);
      if (args.url) {
        try { const u = new URL(args.url); return (u.hostname + (u.pathname !== "/" ? u.pathname : "")).slice(0, 80); } catch {}
      }
      if ((args as any).plaintextContent && typeof (args as any).plaintextContent === "string") {
        const s = (args as any).plaintextContent as string;
        const first = s.split(/\n|\.\s/)[0] || s;
        return first.slice(0, 80);
      }
      return "Untitled";
    })();

    const contextId = await ctx.db.insert("contexts", {
      userId: args.userId,
      projectId: args.projectId,
      tagIds: args.tagIds,
      tags: args.tags,
      type: (args as any).type,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      url: args.url,
      title: computedTitle,
      encryptedContent: args.encryptedContent,
      encryptedTitle: args.encryptedTitle,
      encryptedSummary: args.encryptedSummary,
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
        title: "",
        totalContexts,
      });
      await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateEncryptedSummary, {
        userId: args.userId,
        contextId,
        content: args.plaintextContent,
      });
      // Auto title refinement and project classification
      await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateTitleAndProject, {
        userId: args.userId,
        contextId,
        content: args.plaintextContent,
        currentTitle: computedTitle,
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