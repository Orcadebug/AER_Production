import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import crypto from "crypto";

// Validate password reset token
export const verifyPasswordResetToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const tokenRecord = await ctx.db
      .query("password_reset_tokens")
      .filter((q) => q.eq(q.field("tokenHash"), tokenHash))
      .first();

    if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < Date.now()) {
      return { valid: false, message: "Invalid or expired token" };
    }

    const user = await ctx.db.get(tokenRecord.userId);
    return {
      valid: true,
      email: tokenRecord.email,
      userId: tokenRecord.userId,
      userName: user?.name || user?.email || "User",
    };
  },
});

// Mark password reset token as used after successful password reset via auth
export const markPasswordResetTokenUsed = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const tokenRecord = await ctx.db
      .query("password_reset_tokens")
      .filter((q) => q.eq(q.field("tokenHash"), tokenHash))
      .first();

    if (!tokenRecord) {
      throw new Error("Token not found");
    }

    await ctx.db.patch(tokenRecord._id, { used: true });

    // Log audit event
    await ctx.db.insert("audit_logs", {
      timestamp: Date.now(),
      userId: tokenRecord.userId,
      action: "PASSWORD_RESET_COMPLETED",
      resource: "users",
      resourceId: tokenRecord.userId as any,
      result: "SUCCESS",
      metadata: { email: tokenRecord.email },
    });

    return { success: true };
  },
});
