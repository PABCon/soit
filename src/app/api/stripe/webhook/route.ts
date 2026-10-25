import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { sendEmail } from "@/lib/email/send";
import { topEmployerSubscribedEmail } from "@/lib/email/templates/top-employer-subscribed";
import { jobAdsSubscribedEmail } from "@/lib/email/templates/job-ads-subscribed";
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

  // §pricing — every paid plan (job-ads slots, same as Top Employer) is a
  // real recurring Stripe subscription now; one-time `mode: "payment"`
  // checkouts are no longer created anywhere in this app.
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "subscription" && session.payment_status !== "unpaid") {
      await activateSubscriptionFromSession(session);
    }
  }

  // §pricing — a subscription's own lifecycle, independent of the initial
  // checkout: renewals, payment failures, and cancellations all happen
  // after the session that created the subscription, invisible to an
  // integration that only reads checkout.session.completed (the Stripe
  // billing skill's own explicit warning). Resolved through the
  // subscription's own `metadata.company_id` (set at creation via
  // `subscription_data.metadata`) — the object-graph, not a lookup
  // through the checkout session, which isn't available on these events.
  // Covers both Top Employer and job-ad-slot subscriptions — see
  // `upsertCompanySubscription`'s own comment for how it tells them apart.
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const companyId = subscription.metadata?.company_id;
    if (companyId) await upsertCompanySubscription(companyId, subscription);
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

/** Statuses under which a subscription's perks stay active — `past_due`
 *  gets a grace period (Stripe's own default retry/dunning is still in
 *  progress), matching common SaaS practice rather than revoking on the
 *  very first missed payment. Shared by both plan types. */
const SUBSCRIPTION_ACTIVE_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

/** Tells a job-ads subscription apart from a Top Employer one: every
 *  job-ads Price (self-serve tiers and custom deals like a 200-slot
 *  enterprise plan alike) carries a `job_ad_slots` metadata value set
 *  directly on the Stripe Price — no code change needed to add a new
 *  custom tier, just a Price with this one field set. Its absence means
 *  Top Employer. */
async function resolvePlan(
  subscription: Stripe.Subscription,
): Promise<{ planType: "job_ads"; slotCap: number } | { planType: "top_employer"; slotCap: null }> {
  let price = subscription.items.data[0]?.price;
  if (price && typeof price === "string") price = await stripe.prices.retrieve(price);
  const slots = Number(price?.metadata?.job_ad_slots ?? 0);
  if (slots > 0) return { planType: "job_ads", slotCap: slots };
  return { planType: "top_employer", slotCap: null };
}

async function activateSubscriptionFromSession(session: Stripe.Checkout.Session) {
  const companyId = session.client_reference_id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!companyId || !subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const resolved = await upsertCompanySubscription(companyId, subscription);
  await logEvent("company.subscribed", { companyId, subscriptionId, plan: resolved.planType }, undefined);

  const admin = createAdminClient();
  const [{ data: company }, recipient] = await Promise.all([
    admin.from("companies").select("company_name").eq("id", companyId).single(),
    resolveBillingRecipient(admin, companyId, session),
  ]);
  if (recipient) {
    const billingInterval = subscription.metadata?.billing_interval === "year" ? "year" : "month";
    const periodEndSeconds = subscription.items.data[0]?.current_period_end;
    const renewalDate = periodEndSeconds
      ? new Date(periodEndSeconds * 1000).toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" })
      : null;
    const companyName = company?.company_name ?? "there";
    await sendEmail(
      resolved.planType === "job_ads"
        ? jobAdsSubscribedEmail({ to: recipient, companyName, slotCap: resolved.slotCap, billingInterval, renewalDate })
        : topEmployerSubscribedEmail({ to: recipient, companyName, billingInterval, renewalDate }),
    );
  }
}

/** Shared lifecycle sync for both subscription types — creation, renewal,
 *  and cancellation all land here. Returns what it resolved so the caller
 *  (only the initial-activation path needs this) can pick the right
 *  confirmation email without re-deriving the same thing twice. */
async function upsertCompanySubscription(
  companyId: string,
  subscription: Stripe.Subscription,
): Promise<{ planType: "job_ads"; slotCap: number } | { planType: "top_employer"; slotCap: null }> {
  const admin = createAdminClient();
  const isActive = SUBSCRIPTION_ACTIVE_STATUSES.includes(subscription.status);
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const plan = await resolvePlan(subscription);

  await admin.from("company_subscriptions").upsert(
    {
      company_id: companyId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      plan_type: plan.planType,
      slot_cap: plan.slotCap,
      billing_interval: subscription.metadata?.billing_interval === "year" ? "year" : "month",
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  // One Stripe Customer per company, reused across both subscription
  // types — set once, on whichever subscription activates first, so a
  // later purchase of the other product's Checkout Session can attach to
  // the same Customer instead of Stripe minting a second one (which would
  // split billing history across two Customers and break the portal).
  await admin
    .from("companies")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("id", companyId)
    .is("stripe_customer_id", null);

  await admin
    .from("companies")
    .update(
      plan.planType === "job_ads"
        ? { job_ad_slot_cap: isActive ? plan.slotCap : 1 }
        : {
            top_employer_active: isActive,
            top_employer_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          },
    )
    .eq("id", companyId);

  return plan;
}
