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

export const createBillingPortal = httpAction(async (ctx, req) => {
  try {
    const origin = req.headers.get("Origin");
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
    if (!process.env.STRIPE_SECRET_KEY || !process.env.SITE_URL) {
      return new Response(JSON.stringify({ error: "Stripe not configured for this deployment" }), {
        status: 501,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    const url = await ctx.runAction((api as any).payments.createBillingPortal, {
      userId,
      returnUrl: `${process.env.SITE_URL || ''}/settings?billing=portal`,
    });
    return new Response(JSON.stringify(url), { status: 200, headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) } });
  } catch {
    const origin = req.headers.get("Origin");
    return new Response(JSON.stringify({ error: "Portal failed" }), { status: 500, headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) } });
  }
});

// Preflight handler for portal endpoint
export const portalOptions = httpAction(async (_ctx, req) => {
  const origin = req.headers.get("Origin");
  return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
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

    const body = await req.json().catch(() => ({ plan: "pro", billing: "monthly" }));
    const plan = String(body?.plan || "pro").toLowerCase(); // "pro" | "max"
    const billing = String(body?.billing || "monthly").toLowerCase(); // "monthly" | "yearly"

    const priceKey = (() => {
      const p = plan === "max" ? "MAX" : "PRO";
      const b = billing === "yearly" ? "YEARLY" : "MONTHLY";
      return `STRIPE_PRICE_${p}_${b}` as const;
    })();

    const priceId = (process.env as any)[priceKey] as string | undefined;

    if (!process.env.STRIPE_SECRET_KEY || !process.env.SITE_URL || !priceId) {
      return new Response(JSON.stringify({ error: "Stripe not configured for this plan", plan, billing, missing: { hasSecret: !!process.env.STRIPE_SECRET_KEY, hasPrice: !!priceId, hasSiteUrl: !!process.env.SITE_URL } }), {
        status: 501,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
      });
    }

    const url = await ctx.runAction((api as any).payments.createCheckoutSession, {
      userId,
      priceId,
      successUrl: `${process.env.SITE_URL || ''}/settings?upgrade=success`,
      cancelUrl: `${process.env.SITE_URL || ''}/settings?upgrade=cancel`,
    });
    return new Response(JSON.stringify(url), {
      status: 200,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  } catch (e: any) {
    const origin = req.headers.get("Origin");
    const message = e?.message || String(e);
    try { console.error("Checkout failed:", message); } catch {}
    return new Response(JSON.stringify({ error: "Checkout failed", detail: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(origin) },
    });
  }
});
