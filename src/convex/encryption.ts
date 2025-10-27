import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { getCurrentUser } from "./users";

/**
 * Log encryption/decryption events for audit trail
 */
export const logAuditEvent = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      success: args.success,
      errorMessage: args.errorMessage,
    });
  },
});

/**
 * Get user's encryption keys
 */
export const getUserKeys = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return {
      publicKey: user.publicKey,
      encryptedPrivateKey: user.encryptedPrivateKey,
      keyVersion: user.keyVersion || 1,
    };
  },
});

/**
 * Store user's encryption keys
 */
export const storeUserKeys = internalMutation({
  args: {
    userId: v.id("users"),
    publicKey: v.string(),
    encryptedPrivateKey: v.string(),
    keyVersion: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      publicKey: args.publicKey,
      encryptedPrivateKey: args.encryptedPrivateKey,
      keyVersion: args.keyVersion,
    });
  },
});
