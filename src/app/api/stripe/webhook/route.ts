import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { sendEmail } from "@/lib/email/send";
import { adCreditsPurchasedEmail } from "@/lib/email/templates/ad-credits-purchased";
import { topEmployerSubscribedEmail } from "@/lib/email/templates/top-employer-subscribed";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    // Per the Stripe payments skill: fulfill only when payment_status
    // isn't "unpaid" — a delayed-notification payment method can fire
    // checkout.session.completed while still unpaid, resolved later by
    // async_payment_succeeded (or async_payment_failed, never fulfilled).
    if (session.mode === "payment" && session.payment_status !== "unpaid") {
      await fulfillAdCreditPurchase(session);
    } else if (session.mode === "subscription") {
      await activateTopEmployerFromSession(session);
    }
  }

  // §pricing Phase 2 — Top Employer's own lifecycle, independent of the
  // initial checkout: renewals, payment failures, and cancellations all
  // happen after the session that created the subscription, invisible to
  // an integration that only reads checkout.session.completed (the
  // Stripe billing skill's own explicit warning). Resolved through the
  // subscription's own `metadata.company_id` (set at creation via
  // `subscription_data.metadata`) — the object-graph, not a lookup
  // through the checkout session, which isn't available on these events.
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await syncTopEmployerSubscription(event.data.object as Stripe.Subscription);
  }

  return new Response("ok", { status: 200 });
}

/** Checkout always collects a payer email even for guest/one-time
 *  payments, so that's the first choice — it's the address the person
 *  who just paid is actually watching. Falls back to the first team
 *  member's account email (same lookup applications.ts already uses for
 *  new-applicant notifications) only if Stripe didn't capture one. */
async function resolveBillingRecipient(
  admin: SupabaseClient,
  companyId: string,
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  if (session.customer_details?.email) return session.customer_details.email;

  const { data: members } = await admin
    .from("employer_users")
    .select("auth_user_id")
    .eq("company_id", companyId)
    .limit(1);
  const authUserId = members?.[0]?.auth_user_id;
  if (!authUserId) return null;
  const { data } = await admin.auth.admin.getUserById(authUserId);
  return data.user?.email ?? null;
}

/** Statuses under which Top Employer perks stay active — `past_due` gets
 *  a grace period (Stripe's own default retry/dunning is still in
 *  progress), matching common SaaS practice rather than revoking on the
 *  very first missed payment. */
const TOP_EMPLOYER_ACTIVE_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

async function activateTopEmployerFromSession(session: Stripe.Checkout.Session) {
  const companyId = session.client_reference_id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!companyId || !subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertCompanySubscription(companyId, subscription);
  await logEvent("company.subscribed", { companyId, subscriptionId, plan: "top_employer" }, undefined);

  const admin = createAdminClient();
  const [{ data: company }, recipient] = await Promise.all([
    admin.from("companies").select("company_name").eq("id", companyId).single(),
    resolveBillingRecipient(admin, companyId, session),
  ]);
  if (recipient) {
    const billingInterval = subscription.metadata?.billing_interval === "year" ? "year" : "month";
    await sendEmail(
      topEmployerSubscribedEmail({ to: recipient, companyName: company?.company_name ?? "there", billingInterval }),
    );
  }
}

async function syncTopEmployerSubscription(subscription: Stripe.Subscription) {
  const companyId = subscription.metadata?.company_id;
  if (!companyId) return;
  await upsertCompanySubscription(companyId, subscription);
}

async function upsertCompanySubscription(companyId: string, subscription: Stripe.Subscription) {
  const admin = createAdminClient();
  const isActive = TOP_EMPLOYER_ACTIVE_STATUSES.includes(subscription.status);
  const periodEnd = subscription.items.data[0]?.current_period_end;

  await admin.from("company_subscriptions").upsert(
    {
      company_id: companyId,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      billing_interval: subscription.metadata?.billing_interval === "year" ? "year" : "month",
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  await admin
    .from("companies")
    .update({
      top_employer_active: isActive,
      top_employer_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    })
    .eq("id", companyId);
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
    .select("company_name, ad_credits_available")
    .eq("id", companyId)
    .single();
  await admin
    .from("companies")
    .update({ ad_credits_available: (company?.ad_credits_available ?? 0) + quantity })
    .eq("id", companyId);

  await logEvent("job_ad.purchased", { companyId, quantity, totalCents: session.amount_total }, undefined);

  const recipient = await resolveBillingRecipient(admin, companyId, session);
  if (recipient) {
    await sendEmail(
      adCreditsPurchasedEmail({
        to: recipient,
        companyName: company?.company_name ?? "there",
        quantity,
        totalCents: session.amount_total ?? 0,
        currency: session.currency ?? "eur",
      }),
    );
  }
}
