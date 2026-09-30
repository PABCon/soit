import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";

// First signature-verifying route in this codebase. Reads the raw text
// body (App Router route handlers give this directly, no special config
// needed) and verifies it before touching anything — the Stripe security
// skill's #1 rule.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new Response(`Signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  // §pricing Phase 1 scope only: one-time ad-credit purchases
  // (mode: "payment"). Top Employer's subscription lifecycle
  // (mode: "subscription", customer.subscription.*, invoice.paid) is
  // Phase 2 — nothing sells that yet, so there's nothing to fulfill here
  // for it.
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    // Per the Stripe payments skill: fulfill only when payment_status
    // isn't "unpaid" — a delayed-notification payment method can fire
    // checkout.session.completed while still unpaid, resolved later by
    // async_payment_succeeded (or async_payment_failed, never fulfilled).
    if (session.mode === "payment" && session.payment_status !== "unpaid") {
      await fulfillAdCreditPurchase(session);
    }
  }

  return new Response("ok", { status: 200 });
}

async function fulfillAdCreditPurchase(session: Stripe.Checkout.Session) {
  const companyId = session.client_reference_id;
  const quantity = Number(session.metadata?.ad_credit_quantity ?? 0);
  if (!companyId || !quantity) return;

  const admin = createAdminClient();

  // Idempotent: a unique index on stripe_checkout_session_id means a
  // retried webhook delivery for the same session is a harmless duplicate-
  // key error, not a double credit.
  const { error: insertError } = await admin.from("job_ad_purchases").insert({
    company_id: companyId,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    quantity,
    unit_price_cents: Math.round((session.amount_total ?? 0) / quantity),
    total_cents: session.amount_total ?? 0,
    currency: session.currency ?? "eur",
  });
  if (insertError) {
    if (insertError.code === "23505") return; // already fulfilled
    console.error("job_ad_purchases insert failed:", insertError.message);
    return;
  }

  const { data: company } = await admin
    .from("companies")
    .select("ad_credits_available")
    .eq("id", companyId)
    .single();
  await admin
    .from("companies")
    .update({ ad_credits_available: (company?.ad_credits_available ?? 0) + quantity })
    .eq("id", companyId);

  await logEvent("job_ad.purchased", { companyId, quantity, totalCents: session.amount_total }, undefined);
}
