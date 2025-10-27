import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { getCurrentUser } from "./users";

/**
 * Log an audit event for encryption/decryption operations
 */
export const logAuditEvent = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      userId: args.userId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      timestamp: Date.now(),
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      success: args.success,
      errorMessage: args.errorMessage,
    });
  },
});

/**
 * Get audit logs for the current user
 */
export const getUserAuditLogs = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const limit = args.limit || 100;

    return await ctx.db
      .query("auditLog")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});
