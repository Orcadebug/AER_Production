import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";

/**
 * Redeem access codes to set membership tiers
 * Example codes:
 *  - beta24 -> membershipTier: "beta"
 *  - Madhuri3081 -> membershipTier: "owner"
 */
export const redeemCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const raw = (args.code || "").trim();
    const code = raw.toLowerCase();

    let tier: "beta" | "owner" | null = null;
    if (code === "beta24") tier = "beta";
    if (code === "madhuri3081") tier = "owner";

    if (!tier) {
      return { success: false, message: "Invalid code" } as const;
    }

    await ctx.db.patch(user._id, { membershipTier: tier });

    return { success: true, tier } as const;
  },
});