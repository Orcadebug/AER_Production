import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

// Allowed origins for CORS
const ALLOWED_ORIGINS = new Set<string>([
  "https://www.aercarbon.com",
  "https://aercarbon.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function buildCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.aercarbon.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  } as Record<string, string>;
}

// Preflight handler for checkout endpoint
export const checkoutOptions = httpAction(async (_ctx, req) => {
  const origin = req.headers.get("Origin");
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
});

// Simple API wrapper to create Stripe checkout without exposing secrets client-side
export const createProCheckout = httpAction(async (ctx, req) => {
  try {
    const origin = req.headers.get("Origin");
    // Authenticate using token format: Bearer aer_{userId}
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }
    const token = authHeader.substring(7);
    if (!token.startsWith("aer_")) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }
    const userId = token.substring(4) as any;

    const url = await ctx.runAction(api.payments.createCheckoutSession as any, {
      userId,
      priceId: process.env.STRIPE_PRICE_PRO as string,
      successUrl: `${process.env.SITE_URL || ''}/settings?upgrade=success`,
      cancelUrl: `${process.env.SITE_URL || ''}/settings?upgrade=cancel`,
    });
    return new Response(JSON.stringify(url), {
      status: 200,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  } catch (e) {
    const origin = req.headers.get("Origin");
    return new Response(JSON.stringify({ error: "Checkout failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  }
});
