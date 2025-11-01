import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

// Simple API wrapper to create Stripe checkout without exposing secrets client-side
export const createProCheckout = httpAction(async (ctx, req) => {
  try {
const url = await ctx.runAction(api.payments.createCheckoutSession, {
      priceId: process.env.STRIPE_PRICE_PRO as string,
      successUrl: `${process.env.SITE_URL || ''}/settings?upgrade=success`,
      cancelUrl: `${process.env.SITE_URL || ''}/settings?upgrade=cancel`,
    });
    return new Response(JSON.stringify(url), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Checkout failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});