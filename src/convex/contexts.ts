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
    title: v.string(),
    content: v.string(),
    type: v.union(v.literal("note"), v.literal("file"), v.literal("web")),
    projectId: v.optional(v.id("projects")),
    tagIds: v.optional(v.array(v.id("tags"))),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    url: v.optional(v.string()),
    // Encrypted fields
    encryptedContent: encryptedDataValidator,
    encryptedTitle: v.optional(encryptedDataValidator),
    encryptedSummary: v.optional(encryptedDataValidator),
    encryptedMetadata: v.optional(encryptedDataValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    // Log audit event
    await ctx.scheduler.runAfter(0, internal.audit.logAuditEvent, {
      userId: user._id,
      action: "CREATE_CONTEXT",
      resourceType: "context",
      success: true,
    });

    return await ctx.db.insert("contexts", {
      userId: user._id,
      title: args.title,
      content: args.content,
      type: args.type,
      projectId: args.projectId,
      tagIds: args.tagIds,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      url: args.url,
      encryptedContent: args.encryptedContent,
      encryptedTitle: args.encryptedTitle,
      encryptedSummary: args.encryptedSummary,
      encryptedMetadata: args.encryptedMetadata,
    });
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

    return await ctx.db
      .query("contexts")
      .withSearchIndex("search_content", (q) =>
        q.search("content", args.query).eq("userId", user._id)
      )
      .take(20);
  },
});

export const get = query({
  args: { id: v.id("contexts") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const context = await ctx.db.get(args.id);
    if (!context || context.userId !== user._id) return null;

    return context;
  },
});

export const update = mutation({
  args: {
    id: v.id("contexts"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    tagIds: v.optional(v.array(v.id("tags"))),
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
      title: args.title,
      content: args.content,
      projectId: args.projectId,
      tagIds: args.tagIds,
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
      markdown += `## ${context.title}\n\n`;
      markdown += `**Type:** ${context.type}\n\n`;
      markdown += `**Created:** ${new Date(context._creationTime).toLocaleString()}\n\n`;
      if (context.projectId) {
        markdown += `**Project ID:** ${context.projectId}\n\n`;
      }
      markdown += `**Content:**\n\n${context.content}\n\n`;
      markdown += `---\n\n`;
    }

    return {
      format: "markdown",
      data: markdown,
      filename: `aer-export-${Date.now()}.md`,
    };
  },
});