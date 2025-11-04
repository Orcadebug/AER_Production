import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { internal } from "./_generated/api";

const encryptedDataValidator = v.object({
  ciphertext: v.string(),
  nonce: v.string(),
});

export const create = mutation({
  args: {
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
    // Encrypted fields (required)
    encryptedContent: encryptedDataValidator,
    encryptedTitle: v.optional(encryptedDataValidator),
    encryptedSummary: v.optional(encryptedDataValidator),
    encryptedMetadata: v.optional(encryptedDataValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    // Enforce encrypted input only
    const encContent = args.encryptedContent;
    if (!encContent?.ciphertext || !encContent?.nonce) {
      throw new Error("Missing encrypted content");
    }

    const encTitle = args.encryptedTitle;
    const encSummary = args.encryptedSummary;

    // Insert context (no plaintext fields)
    const contextId = await ctx.db.insert("contexts", {
      userId: user._id,
      projectId: args.projectId,
      tagIds: args.tagIds,
      tags: args.tags,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      url: args.url,
      encryptedContent: encContent,
      encryptedTitle: encTitle,
      encryptedSummary: encSummary,
      encryptedMetadata: args.encryptedMetadata,
    });

    // Track approximate storage usage
    try {
      const bytes =
        (encContent?.ciphertext?.length || 0) +
        (encTitle?.ciphertext?.length || 0) +
        (encSummary?.ciphertext?.length || 0);
      await ctx.scheduler.runAfter(0, internal.entitlements.addStorageBytes, {
        userId: user._id,
        bytes,
      });
    } catch {}

    // No server-side AI generation: client should supply tags only

    // Log audit event
    await ctx.scheduler.runAfter(0, internal.audit.logAuditEvent, {
      userId: user._id,
      action: "CREATE_CONTEXT",
      resourceType: "context",
      success: true,
    });

    return contextId;
  },
});

export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    tagId: v.optional(v.id("tags")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    let contexts = await ctx.db
      .query("contexts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    if (args.projectId) {
      contexts = contexts.filter((c) => c.projectId === args.projectId);
    }

    if (args.tagId) {
      contexts = contexts.filter(
        (c) => c.tagIds && c.tagIds.includes(args.tagId!)
      );
    }

    return contexts;
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Get all user contexts with tags
    const allContexts = await ctx.db
      .query("contexts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // If no search query, return contexts that have tags (client can rank)
    if (!args.query || args.query.trim().length === 0) {
      return allContexts.filter((c) => c.tags && c.tags.length > 0).slice(0, 20);
    }

    // Filter by tag substring match on the server (privacy-safe)
    const q = args.query.toLowerCase();
    return allContexts.filter((c) => (c.tags || []).some((t: string) => t.toLowerCase().includes(q)));
  },
});

export const get = query({
  args: { id: v.id("contexts") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const context = await ctx.db.get(args.id);
    if (!context || context.userId !== user._id) return null;

    return context; // Encrypted fields only; client must decrypt
  },
});

export const update = mutation({
  args: {
    id: v.id("contexts"),
    projectId: v.optional(v.id("projects")),
    tagIds: v.optional(v.array(v.id("tags"))),
    tags: v.optional(v.array(v.string())),
    encryptedContent: v.optional(encryptedDataValidator),
    encryptedTitle: v.optional(encryptedDataValidator),
    encryptedSummary: v.optional(encryptedDataValidator),
    encryptedMetadata: v.optional(encryptedDataValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const context = await ctx.db.get(args.id);
    if (!context || context.userId !== user._id) {
      throw new Error("Context not found");
    }

    await ctx.db.patch(args.id, {
      projectId: args.projectId,
      tagIds: args.tagIds,
      tags: args.tags,
      encryptedContent: args.encryptedContent,
      encryptedTitle: args.encryptedTitle,
      encryptedSummary: args.encryptedSummary,
      encryptedMetadata: args.encryptedMetadata,
    });

    // Log audit event
    await ctx.scheduler.runAfter(0, internal.audit.logAuditEvent, {
      userId: user._id,
      action: "UPDATE_CONTEXT",
      resourceType: "context",
      resourceId: args.id,
      success: true,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("contexts") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const context = await ctx.db.get(args.id);
    if (!context || context.userId !== user._id) {
      throw new Error("Context not found");
    }

    await ctx.db.delete(args.id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const listPaginated = query({
  args: {
    projectId: v.optional(v.id("projects")),
    tagId: v.optional(v.id("tags")),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { page: [], isDone: true, continueCursor: null };

    let query = ctx.db
      .query("contexts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc");

    const result = await query.paginate(args.paginationOpts);

    let page = result.page;

    if (args.projectId) {
      page = page.filter((c) => c.projectId === args.projectId);
    }

    if (args.tagId) {
      page = page.filter((c) => c.tagIds && c.tagIds.includes(args.tagId!));
    }

    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const exportAllContexts = query({
  args: { format: v.union(v.literal("markdown"), v.literal("json")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const contexts = await ctx.db
      .query("contexts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    if (args.format === "json") {
      return {
        format: "json",
        data: JSON.stringify(contexts, null, 2),
        filename: `aer-export-${Date.now()}.json`,
      };
    }

    // Markdown format
    let markdown = `# Aer Context Export\n\nExported on: ${new Date().toLocaleString()}\n\n---\n\n`;
    
    for (const context of contexts) {
      markdown += `## (encrypted title)\n\n`;
      markdown += `**Created:** ${new Date(context._creationTime).toLocaleString()}\n\n`;
      if (context.projectId) {
        markdown += `**Project ID:** ${context.projectId}\n\n`;
      }
      if (context.tags && context.tags.length) {
        markdown += `**Tags:** ${context.tags.join(", ")}\n\n`;
      }
      markdown += `**Content:** [Encrypted - decrypt client-side to view]\n\n`;
      markdown += `---\n\n`;
    }

    return {
      format: "markdown",
      data: markdown,
      filename: `aer-export-${Date.now()}.md`,
    };
  },
});