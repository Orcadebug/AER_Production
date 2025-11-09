import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getCurrentUser } from "./users";
import { internal, api } from "./_generated/api";
import { serverDecryptString } from "./crypto";

const encryptedDataValidator = v.object({
  ciphertext: v.string(),
  nonce: v.string(),
});

export const create = mutation({
  args: {
    // Legacy optional fields (used for plaintext title indexing only)
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

    // Rate-limit uploads per user per minute based on tier
    try {
      const rl = await ctx.runMutation(internal.entitlements.assertAndIncrementRateLimit, {
        userId: user._id,
        key: "upload",
      });
      if (!rl.ok) {
        throw new Error(`Rate limit exceeded: ${rl.used}/${rl.limit}. Try again in ${Math.ceil((rl.retryAfterMs || 0)/1000)}s or upgrade your plan.`);
      }
    } catch (e) {
      throw e;
    }

    // Enforce encrypted input only
    const encContent = args.encryptedContent;
    if (!encContent?.ciphertext || !encContent?.nonce) {
      throw new Error("Missing encrypted content");
    }

    const encTitle = args.encryptedTitle;
    const encSummary = args.encryptedSummary;

    // Enforce storage quota before inserting
    const approxBytes =
      (encContent?.ciphertext?.length || 0) +
      (encTitle?.ciphertext?.length || 0) +
      (encSummary?.ciphertext?.length || 0) +
      (args.encryptedMetadata?.ciphertext?.length || 0);
    const storage = await ctx.runQuery(internal.entitlements.assertStorageAllowed, {
      userId: user._id,
      additionalBytes: approxBytes,
    });
    if (!storage.ok) {
      throw new Error(
        `Storage limit reached (${Math.round(storage.used/1024/1024)}MB of ${storage.allowed === Number.MAX_SAFE_INTEGER ? '∞' : Math.round(storage.allowed/1024/1024)+'MB'}). Delete items or upgrade your plan.`
      );
    }

    // Compute a plaintext title for indexing/search (no secrets)
    const computedTitle = (() => {
      if (typeof args.title === "string" && args.title.trim().length > 0) {
        return args.title.trim().slice(0, 80);
      }
      if (args.fileName && args.fileName.length > 0) return args.fileName.slice(0, 80);
      if (args.url && args.url.length > 0) {
        try { const u = new URL(args.url); return (u.hostname + (u.pathname !== "/" ? u.pathname : "")).slice(0, 80); } catch {}
      }
      if (args.plaintextContent && args.plaintextContent.length > 0) {
        const firstLine = args.plaintextContent.split(/\n|\.\s/)[0] || args.plaintextContent;
        return firstLine.slice(0, 80);
      }
      return "Untitled";
    })();

    // Insert context (store plaintext title for UX only; content remains encrypted)
    const contextId = await ctx.db.insert("contexts", {
      userId: user._id,
      projectId: args.projectId,
      tagIds: args.tagIds,
      tags: args.tags,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      url: args.url,
      title: computedTitle,
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

    // Server-side AI enrichment (tags/summary/title+project) when plaintext preview provided
    if ((args.plaintextContent || "").trim().length > 0 && process.env.PERPLEXITY_API_KEY) {
      const preview = (args.plaintextContent as string).slice(0, 6000);
      try {
        // Generate tags
        await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateTags, {
          userId: user._id,
          contextId,
          content: preview,
          title: args.title || "",
          totalContexts: await ctx.db
            .query("contexts")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect()
            .then((cs) => cs.length),
        });
        // Generate encrypted summary
        await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateEncryptedSummary, {
          userId: user._id,
          contextId,
          content: preview,
        });
        // Title refinement and project assignment
        await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateTitleAndProject, {
          userId: user._id,
          contextId,
          content: preview,
          currentTitle: args.title || "",
        });
      } catch (e) {
        console.error("AI enrichment scheduling failed:", e);
      }
    }

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
    title: v.optional(v.string()),
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
      title: typeof args.title === "string" ? args.title.slice(0, 80) : undefined,
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

export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {} as any);
    if (!user) throw new Error("Unauthorized");

    // Prevent creating upload URLs when storage is already at or above quota
    const status = await ctx.runQuery(internal.entitlements.getStorageStatus, { userId: user._id });
    if (status.allowed !== Number.MAX_SAFE_INTEGER && status.used >= status.allowed) {
      throw new Error(
        `Storage limit reached (${Math.round(status.used/1024/1024)}MB). Delete items or upgrade your plan.`
      );
    }

    // Rate-limit upload URL generation as part of API usage
    const rl = await ctx.runMutation(internal.entitlements.assertAndIncrementRateLimit, {
      userId: user._id,
      key: "api",
    });
    if (!rl.ok) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((rl.retryAfterMs||0)/1000)}s.`);
    }

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

export const decryptServer = action({
  args: { id: v.id("contexts") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(api.contexts.get, { id: args.id });
    if (!context) throw new Error("Not found");
    const enc = (context as any).encryptedContent as { ciphertext: string; nonce: string } | undefined;
    if (!enc || !enc.ciphertext || !enc.nonce) return "";
    const plain = serverDecryptString(enc.ciphertext, enc.nonce);
    return plain || "";
  },
});

export const decryptSummaryServer = action({
  args: { id: v.id("contexts") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(api.contexts.get, { id: args.id });
    if (!context) throw new Error("Not found");
    const sum = (context as any).encryptedSummary as { ciphertext: string; nonce: string } | undefined;
    if (!sum || !sum.ciphertext || !sum.nonce) return "";
    if (sum.nonce === 'plain') return String(sum.ciphertext || '');
    const plain = serverDecryptString(sum.ciphertext, sum.nonce);
    return plain || "";
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