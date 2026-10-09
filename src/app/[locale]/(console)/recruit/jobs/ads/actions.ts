"use server";

import { stripe, newIntegrationIdentifier } from "@/lib/stripe";
import { getMyEmployerContext } from "@/lib/db/companies";
import { createClient } from "@/lib/supabase/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Matches scripts/stripe-setup.mjs's lookup_keys — one Product ("Job Ad
// Credits"), one flat one-time Price per pack size (a genuine billing
// variant of the same plan, not a different tier — see the Stripe
// billing skill's "one Product per tier" rule). Referenced by lookup_key,
// never a hardcoded Price ID, so the catalog can be re-run/reprovisioned
// without touching this file.
const PACK_LOOKUP_KEYS = {
  1: "job_ad_credits_1",
  2: "job_ad_credits_2",
  3: "job_ad_credits_3",
  5: "job_ad_credits_5",
} as const;

export type AdCreditPackSize = keyof typeof PACK_LOOKUP_KEYS;

export type CreateCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not_an_employer" | "price_not_found" | "stripe_error" };

/** Self-serve job-ad credit purchase (§pricing) — one-time Stripe Checkout,
 *  `mode: "payment"`. 6+ packs are deliberately not offered here at all —
 *  that's the "talk to sales" path (a contact form + a manually-created
 *  Stripe invoice/subscription), not a self-serve amount. Fulfillment
 *  (crediting `companies.ad_credits_available`) happens in the webhook
 *  handler, never here or on the success page — a customer can pay and
 *  lose their connection before ever seeing the success page, and
 *  fulfillment must not depend on that page loading. */
export async function createAdCreditCheckoutAction(
  quantity: AdCreditPackSize,
  locale: string,
): Promise<CreateCheckoutResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  try {
    const lookupKey = PACK_LOOKUP_KEYS[quantity];
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    const price = prices.data[0];
    if (!price) return { ok: false, reason: "price_not_found" };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: ctx.company.id,
      metadata: { ad_credit_quantity: String(quantity) },
      integration_identifier: newIntegrationIdentifier("ad_credits"),
      success_url: `${SITE}/${locale}/recruit/jobs/ads?purchase=success`,
      cancel_url: `${SITE}/${locale}/recruit/jobs/ads?purchase=canceled`,
    });

    if (!session.url) return { ok: false, reason: "stripe_error" };
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("createAdCreditCheckoutAction failed:", err);
    return { ok: false, reason: "stripe_error" };
  }
}

const TOP_EMPLOYER_LOOKUP_KEYS = {
  month: "top_employer_monthly",
  year: "top_employer_annual",
} as const;

export type BillingInterval = keyof typeof TOP_EMPLOYER_LOOKUP_KEYS;

/** Top Employer subscription (§pricing phase 2) — recurring Stripe
 *  Checkout, `mode: "subscription"`. Fulfillment (setting
 *  `companies.top_employer_active`) happens in the webhook, same
 *  reasoning as the ad-credit flow: a customer can pay and never see the
 *  success page. */
export async function createTopEmployerCheckoutAction(
  interval: BillingInterval,
  locale: string,
): Promise<CreateCheckoutResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  try {
    const lookupKey = TOP_EMPLOYER_LOOKUP_KEYS[interval];
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    const price = prices.data[0];
    if (!price) return { ok: false, reason: "price_not_found" };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: ctx.company.id,
      subscription_data: { metadata: { company_id: ctx.company.id, billing_interval: interval } },
      integration_identifier: newIntegrationIdentifier("top_employer"),
      success_url: `${SITE}/${locale}/recruit/jobs/ads?subscription=success`,
      cancel_url: `${SITE}/${locale}/recruit/jobs/ads?subscription=canceled`,
    });

    if (!session.url) return { ok: false, reason: "stripe_error" };
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("createTopEmployerCheckoutAction failed:", err);
    return { ok: false, reason: "stripe_error" };
  }
}

export type CreatePortalResult = { ok: true; url: string } | { ok: false; reason: "no_subscription" | "stripe_error" };

/** Billing dashboard — "manage subscription" (cancel, switch plan, view/
 *  download invoices). Routes to Stripe's own hosted Customer Portal
 *  rather than reimplementing any of that: `company_subscriptions` is
 *  only ever written for Top Employer subscribers (ad-credit purchases
 *  are one-time Checkout, no Stripe Customer object created), so a
 *  company with no subscription row has no portal to open — its billing
 *  history is the purchases list on this same page, not the portal.
 *  Requires a Customer Portal configuration to exist (Stripe Dashboard →
 *  Settings → Billing → Customer portal → Save, a one-time setup step —
 *  see CLAUDE.md), otherwise Stripe itself returns a clear error. */
export async function createBillingPortalSessionAction(locale: string): Promise<CreatePortalResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "no_subscription" };

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("company_subscriptions")
    .select("stripe_customer_id")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!subscription?.stripe_customer_id) return { ok: false, reason: "no_subscription" };

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${SITE}/${locale}/recruit/jobs/ads`,
    });
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("createBillingPortalSessionAction failed:", err);
    return { ok: false, reason: "stripe_error" };
  }
}
