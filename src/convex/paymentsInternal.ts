import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const setStripeCustomerId = internalMutation({
  args: { userId: v.id("users"), customerId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { stripeCustomerId: args.customerId });
  },
});

export const setMembershipByCustomerId = internalMutation({
  args: { customerId: v.string(), tier: v.union(v.literal("free"), v.literal("pro")) },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    const u = users.find((u: any) => u.stripeCustomerId === args.customerId);
    if (u) {
      await ctx.db.patch(u._id, { membershipTier: args.tier });
    }
  },
});
