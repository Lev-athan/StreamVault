import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe requires the raw request body to verify the signature, so this
// route must not run through any JSON body-parsing middleware.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature verification failed.` }, { status: 400 });
  }

  const admin = createAdminClient();

  async function setPlanFromSubscription(subscription: Stripe.Subscription) {
    const supabaseUserId = subscription.metadata?.supabase_user_id;
    const status = subscription.status; // active, trialing, past_due, canceled, unpaid, ...
    const isActive = status === "active" || status === "trialing";

    const update = {
      plan: isActive ? "premium" : "free",
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: status,
    } as const;

    if (supabaseUserId) {
      await admin.from("profiles").update(update).eq("id", supabaseUserId);
    } else {
      // Fallback: look the user up by Stripe customer id if metadata was lost.
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      await admin.from("profiles").update(update).eq("stripe_customer_id", customerId);
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await setPlanFromSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      await setPlanFromSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const supabaseUserId = subscription.metadata?.supabase_user_id;
      const update = { plan: "free", stripe_subscription_status: "canceled" } as const;
      if (supabaseUserId) {
        await admin.from("profiles").update(update).eq("id", supabaseUserId);
      } else {
        const customerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        await admin.from("profiles").update(update).eq("stripe_customer_id", customerId);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
