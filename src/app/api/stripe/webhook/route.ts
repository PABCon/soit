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

  // §pricing — a subscription's own lifecycle is the single source of
  // truth for everything: `created` covers a brand-new subscription
  // (whether it came from our own Checkout flow or was created by hand in
  // the Stripe Dashboard against an existing Customer — see
  // `resolveCompanyId`'s own comment), `updated`/`deleted` cover renewals,
  // payment failures, and cancellations. Keying off the subscription's own
  // `status` (via `SUBSCRIPTION_ACTIVE_STATUSES`) rather than a Checkout
  // Session's one-time `payment_status` is also more correct for a slow
  // payment method — a subscription created `incomplete` simply doesn't
  // grant perks yet, and the later `updated` event that flips it to
  // `active` grants them then, with no separate "was this paid" check
  // needed. Covers both Top Employer and job-ad-slot subscriptions — see
  // `upsertCompanySubscription`'s own comment for how it tells them apart.
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const companyId = await resolveCompanyId(subscription);
    if (companyId) {
      const resolved = await upsertCompanySubscription(companyId, subscription);
      if (event.type === "customer.subscription.created" && SUBSCRIPTION_ACTIVE_STATUSES.includes(subscription.status)) {
        await logEvent("company.subscribed", { companyId, subscriptionId: subscription.id, plan: resolved.planType }, undefined);
        await sendSubscriptionConfirmationEmail(companyId, subscription, resolved);
      }
    }
  }

  return new Response("ok", { status: 200 });
}

/** A Checkout-created subscription already carries `metadata.company_id`
 *  (set via `subscription_data.metadata` in both checkout actions). A
 *  subscription created by hand in the Stripe Dashboard — picking an
 *  existing Customer and a Price directly, no Checkout Session involved
 *  at all — never gets that metadata, so this falls back to the
 *  Customer's own `metadata.company_id` instead, set once at registration
 *  by `ensureStripeCustomer`. Either path resolves to the same company. */
async function resolveCompanyId(subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.company_id) return subscription.metadata.company_id;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  return customer.metadata?.company_id ?? null;
}

/** The owning company's first team member — same lookup `applications.ts`
 *  already uses for new-applicant notifications. Every company's Customer
 *  is created with a real email (`ensureStripeCustomer`), but Stripe
 *  doesn't guarantee a Dashboard-created Customer keeps one current, so
 *  this app-side lookup is the one reliable source rather than trusting
 *  whatever Stripe has on file. */
async function resolveBillingRecipient(admin: SupabaseClient, companyId: string): Promise<string | null> {
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
 *  Top Employer. Billing interval is read straight off the Price's own
 *  `recurring.interval` rather than a custom metadata field — correct
 *  automatically whether the subscription came from our Checkout flow or
 *  was created by hand in the Stripe Dashboard, neither of which needs to
 *  separately declare it. */
async function resolvePlan(subscription: Stripe.Subscription): Promise<
  | { planType: "job_ads"; slotCap: number; billingInterval: "month" | "year" }
  | { planType: "top_employer"; slotCap: null; billingInterval: "month" | "year" }
> {
  let price = subscription.items.data[0]?.price;
  if (price && typeof price === "string") price = await stripe.prices.retrieve(price);
  const billingInterval = price?.recurring?.interval === "year" ? "year" : "month";
  const slots = Number(price?.metadata?.job_ad_slots ?? 0);
  if (slots > 0) return { planType: "job_ads", slotCap: slots, billingInterval };
  return { planType: "top_employer", slotCap: null, billingInterval };
}

async function sendSubscriptionConfirmationEmail(
  companyId: string,
  subscription: Stripe.Subscription,
  plan: Awaited<ReturnType<typeof resolvePlan>>,
) {
  const admin = createAdminClient();
  const [{ data: company }, recipient] = await Promise.all([
    admin.from("companies").select("company_name").eq("id", companyId).single(),
    resolveBillingRecipient(admin, companyId),
  ]);
  if (!recipient) return;

  const periodEndSeconds = subscription.items.data[0]?.current_period_end;
  const renewalDate = periodEndSeconds
    ? new Date(periodEndSeconds * 1000).toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const companyName = company?.company_name ?? "there";
  await sendEmail(
    plan.planType === "job_ads"
      ? jobAdsSubscribedEmail({ to: recipient, companyName, slotCap: plan.slotCap, billingInterval: plan.billingInterval, renewalDate })
      : topEmployerSubscribedEmail({ to: recipient, companyName, billingInterval: plan.billingInterval, renewalDate }),
  );
}

/** Shared lifecycle sync for both subscription types — creation, renewal,
 *  and cancellation all land here. Returns what it resolved so the caller
 *  (only the initial-activation path needs this) can pick the right
 *  confirmation email without re-deriving the same thing twice. */
async function upsertCompanySubscription(
  companyId: string,
  subscription: Stripe.Subscription,
): Promise<Awaited<ReturnType<typeof resolvePlan>>> {
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
      billing_interval: plan.billingInterval,
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
