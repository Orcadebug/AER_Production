"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";

// Internal helpers live in paymentsInternal.ts

export const createCheckoutSession: any = action({
  args: {
    userId: v.id("users"),
    priceId: v.string(), // STRIPE_PRICE_PRO
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe not configured");
    }

    // Lookup the user explicitly using provided userId
    const user: any = await ctx.runQuery(internal.users.getUserById, { userId: args.userId });
    if (!user) throw new Error("Unauthorized");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Ensure a valid customer exists for the current Stripe environment
    let customerId = (user as any).stripeCustomerId as string | undefined;
    try {
      if (customerId) {
        const existing = await stripe.customers.retrieve(customerId);
        if ((existing as any)?.deleted) {
          customerId = undefined;
        }
      }
    } catch {
      // Stored ID is invalid for this Stripe account/mode; create a fresh one
      customerId = undefined;
    }
    if (!customerId) {
      const customer: any = await stripe.customers.create({ email: (user as any).email || undefined });
      customerId = customer.id;
      await ctx.runMutation(internal.paymentsInternal.setStripeCustomerId, { userId: user._id, customerId: customerId as string });
    }

    try {
      const session: any = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: args.priceId, quantity: 1 }],
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
      });
      return { url: session.url ?? null };
    } catch (e: any) {
      const message = e?.message || String(e);
      try { console.error("Stripe session error:", message); } catch {}
      throw new Error(message);
    }
  },
});

export const createBillingPortal: any = action({
  args: {
    userId: v.id("users"),
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe not configured");
    }
    const user: any = await ctx.runQuery(internal.users.getUserById, { userId: args.userId });
    if (!user) throw new Error("Unauthorized");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // Ensure a valid customer exists for this environment
    let customerId = (user as any).stripeCustomerId as string | undefined;
    try {
      if (customerId) {
        const existing = await stripe.customers.retrieve(customerId);
        if ((existing as any)?.deleted) {
          customerId = undefined;
        }
      }
    } catch {
      customerId = undefined;
    }
    if (!customerId) {
      const c: any = await stripe.customers.create({ email: (user as any).email || undefined });
      customerId = c.id;
      await ctx.runMutation(internal.paymentsInternal.setStripeCustomerId, { userId: user._id, customerId });
    }

    const session: any = await (stripe as any).billingPortal.sessions.create({
      customer: customerId,
      return_url: args.returnUrl,
    });
    return { url: session.url ?? null };
  },
});

