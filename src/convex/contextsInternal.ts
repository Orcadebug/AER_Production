import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

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
 * Internal mutation to update encrypted summary on a context
 */
export const updateEncryptedSummary = internalMutation({
  args: {
    contextId: v.id("contexts"),
    encryptedSummary: v.object({
      ciphertext: v.string(),
      nonce: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contextId, {
      encryptedSummary: args.encryptedSummary,
    });
  },
});