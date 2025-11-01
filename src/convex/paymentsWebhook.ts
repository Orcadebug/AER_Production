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

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | undefined;
        if (customerId) {
          await ctx.runMutation(internal.paymentsInternal.setMembershipByCustomerId, { customerId, tier: "pro" });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string | undefined;
        if (customerId) {
          await ctx.runMutation(internal.paymentsInternal.setMembershipByCustomerId, { customerId, tier: "free" });
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
