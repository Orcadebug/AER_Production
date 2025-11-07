import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Web Crypto helper to compute SHA-256 hex digest in the default Convex runtime
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Validate password reset token
export const verifyPasswordResetToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const tokenHash = await sha256Hex(token);

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
    const tokenHash = await sha256Hex(token);

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
