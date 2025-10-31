import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

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