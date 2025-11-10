import { httpAction } from "./_generated/server";
import Stripe from "stripe";
import { internal } from "./_generated/api";

export const stripeWebhook = httpAction(async (ctx, request) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return new Response("Stripe not configured", { status: 200 });
    }

    const payload = await request.text();
    const sig = request.headers.get("Stripe-Signature");
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    let event: Stripe.Event;

    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    } else {
      event = JSON.parse(payload);
    }

    const mapPriceOrProductToTier = (price: Stripe.Price | null | undefined): "pro" | "max" => {
      try {
        const priceId = (price as any)?.id as string | undefined;
        const productId = typeof (price as any)?.product === 'string' ? ((price as any).product as string) : (((price as any)?.product as any)?.id as string | undefined);
        const PRO_M = (process.env.STRIPE_PRICE_PRO_MONTHLY || "").trim();
        const PRO_Y = (process.env.STRIPE_PRICE_PRO_YEARLY || "").trim();
        const MAX_M = (process.env.STRIPE_PRICE_MAX_MONTHLY || "").trim();
        const MAX_Y = (process.env.STRIPE_PRICE_MAX_YEARLY || "").trim();
        const PRO_PROD = (process.env.STRIPE_PRODUCT_PRO || "").trim();
        const MAX_PROD = (process.env.STRIPE_PRODUCT_MAX || "").trim();
        if (productId && MAX_PROD && productId === MAX_PROD) return "max";
        if (productId && PRO_PROD && productId === PRO_PROD) return "pro";
        if (priceId && (priceId === MAX_M || priceId === MAX_Y)) return "max";
        return "pro";
      } catch {
        return "pro";
      }
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | undefined;
        const subId = (session.subscription as string) || undefined;
        let tier: "pro" | "max" = "pro";
        let periodEnd: number | undefined = undefined;
        try {
          if (subId) {
            const subResp = await stripe.subscriptions.retrieve(subId);
            const sub = subResp as unknown as Stripe.Subscription;
            const defaultItem: any = (sub as any)?.items?.data?.[0];
            tier = mapPriceOrProductToTier(defaultItem?.price as any);
            periodEnd = Number(((sub as any).current_period_end || 0)) * 1000;
          }
        } catch {}
        if (customerId) {
          await ctx.runMutation(internal.paymentsInternal.setMembershipByCustomerId, { customerId, tier, periodEnd, subscriptionId: subId });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = (sub as any).customer as string | undefined;
        const defaultItem: any = (sub as any)?.items?.data?.[0];
        const tier = mapPriceOrProductToTier(defaultItem?.price as any);
        const periodEnd = Number(((sub as any).current_period_end || 0)) * 1000;
        if (customerId) {
          await ctx.runMutation(internal.paymentsInternal.setMembershipByCustomerId, { customerId, tier, periodEnd, subscriptionId: (sub as any).id });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string | undefined;
        if (customerId) {
          await ctx.runMutation(internal.paymentsInternal.setMembershipByCustomerId, { customerId, tier: "free", periodEnd: undefined, subscriptionId: undefined });
        }
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("Stripe webhook error", err);
    return new Response(JSON.stringify({ error: "Webhook error" }), { status: 400 });
  }
});
