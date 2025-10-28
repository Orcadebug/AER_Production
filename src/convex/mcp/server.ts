"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * MCP Server Tools for Aer Context System
 * Exposes encrypted context management to AI assistants
 */

/**
 * List all contexts for the authenticated user
 * Returns decrypted summaries and tags for AI context
 */
export const listContexts = internalAction({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const contexts: any[] = await ctx.runQuery(internal.contextsInternal.getAllContextsForUser, {
      userId: args.userId,
    });

    const limit = args.limit || 50;
    const limitedContexts: any[] = contexts.slice(0, limit);

    return {
      success: true,
      contexts: limitedContexts.map((c: any) => ({
        id: c._id,
        title: c.title,
        type: c.type,
        tags: c.tags || [],
        createdAt: c._creationTime,
        hasEncryptedContent: !!c.encryptedContent,
      })),
      total: contexts.length,
      returned: limitedContexts.length,
    };
  },
});

/**
 * Search contexts using AI-powered semantic search
 */
export const searchContexts = internalAction({
  args: {
    userId: v.id("users"),
    query: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Use the existing AI semantic search
      const rankedIds: any = await ctx.runAction(internal.ai.semanticSearchPublic, {
        query: args.query,
        userId: args.userId,
      });

      // Get context details for top results
      const contexts: any[] = await ctx.runQuery(internal.contextsInternal.getAllContextsForUser, {
        userId: args.userId,
      });

      const rankedContexts: any[] = rankedIds
        .map((id: string) => contexts.find((c: any) => c._id === id))
        .filter(Boolean)
        .slice(0, 20);

      return {
        success: true,
        query: args.query,
        results: rankedContexts.map((c: any) => ({
          id: c._id,
          title: c.title,
          type: c.type,
          tags: c.tags || [],
          createdAt: c._creationTime,
        })),
        count: rankedContexts.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results: [],
        count: 0,
      };
    }
  },
});

/**
 * Get all unique tags across user's contexts
 */
export const listTags = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const contexts = await ctx.runQuery(internal.contextsInternal.getAllContextsForUser, {
      userId: args.userId,
    });

    const allTags = new Set<string>();
    contexts.forEach((context: any) => {
      if (context.tags) {
        context.tags.forEach((tag: string) => allTags.add(tag));
      }
    });

    const tagCounts: Record<string, number> = {};
    contexts.forEach((context: any) => {
      if (context.tags) {
        context.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    return {
      success: true,
      tags: Array.from(allTags).sort(),
      tagCounts,
      totalUniqueTags: allTags.size,
    };
  },
});

/**
 * Get contexts by specific tags
 */
export const getContextsByTags = internalAction({
  args: {
    userId: v.id("users"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    const contexts: any[] = await ctx.runQuery(internal.contextsInternal.getAllContextsForUser, {
      userId: args.userId,
    });

    const matchingContexts: any[] = contexts.filter((context: any) => {
      if (!context.tags || context.tags.length === 0) return false;
      return args.tags.some((tag: string) => context.tags.includes(tag));
    });

    return {
      success: true,
      tags: args.tags,
      contexts: matchingContexts.map((c: any) => ({
        id: c._id,
        title: c.title,
        type: c.type,
        tags: c.tags || [],
        createdAt: c._creationTime,
      })),
      count: matchingContexts.length,
    };
  },
});

/**
 * Get user statistics
 */
export const getUserStats = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<any> => {
    const contexts: any[] = await ctx.runQuery(internal.contextsInternal.getAllContextsForUser, {
      userId: args.userId,
    });

    // Count projects and tags from contexts
    const projectIds = new Set<string>();
    const allTags = new Set<string>();
    
    contexts.forEach((context: any) => {
      if (context.projectId) {
        projectIds.add(context.projectId);
      }
      if (context.tags) {
        context.tags.forEach((tag: string) => allTags.add(tag));
      }
    });

    const typeBreakdown: Record<string, number> = {};
    contexts.forEach((context: any) => {
      typeBreakdown[context.type] = (typeBreakdown[context.type] || 0) + 1;
    });

    return {
      success: true,
      totalContexts: contexts.length,
      totalProjects: projectIds.size,
      totalTags: allTags.size,
      typeBreakdown,
    };
  },
});

/**
 * Generate AI tags for a query or content
 */
export const generateTagsForContent = internalAction({
  args: {
    content: v.string(),
    title: v.optional(v.string()),
    totalContexts: v.number(),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      const tags: any = await ctx.runAction(internal.ai.generateTags, {
        content: args.content,
        title: args.title || "Untitled",
        totalContexts: args.totalContexts,
      });

      return {
        success: true,
        tags,
        count: tags.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tags: [],
        count: 0,
      };
    }
  },
});
