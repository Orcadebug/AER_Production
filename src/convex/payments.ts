"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";

// Internal helpers live in paymentsInternal.ts

export const createCheckoutSession = action({
  args: {
    priceId: v.string(), // STRIPE_PRICE_PRO
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe not configured");
    }

    const user = await ctx.runQuery(require("./users").getCurrentUserInternal, {} as any);
    if (!user) throw new Error("Unauthorized");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Ensure a customer exists
    let customerId = (user as any).stripeCustomerId as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: (user as any).email || undefined });
      customerId = customer.id;
await ctx.runMutation(internal.paymentsInternal.setStripeCustomerId, { userId: user._id, customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    });

    return { url: session.url };
  },
});

