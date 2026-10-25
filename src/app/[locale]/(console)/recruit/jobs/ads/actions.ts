"use server";

import { stripe, newIntegrationIdentifier } from "@/lib/stripe";
import { getMyEmployerContext } from "@/lib/db/companies";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Matches scripts/stripe-setup.mjs's lookup_keys — one Product ("Job Ad
// Credits"), one recurring monthly Price per plan size (a genuine billing
// variant of the same plan, not a different tier — see the Stripe billing
// skill's "one Product per tier" rule). Referenced by lookup_key, never a
// hardcoded Price ID, so the catalog can be re-run/reprovisioned without
// touching this file. Each Price also carries a `job_ad_slots` metadata
// value the webhook reads directly — a custom deal (e.g. a 200-slot
// enterprise plan) just needs a Price with that same field set, no code
// change here or in the webhook.
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

/** Self-serve job-ads plan (§pricing) — recurring Stripe Checkout,
 *  `mode: "subscription"`: paying monthly keeps up to N job ads live at
 *  once; it lapses back to the free 1 the moment the subscription isn't
 *  active any more. 6+ slots is deliberately not offered here at all —
 *  that's the "talk to sales" path (a contact form + a manually-created
 *  custom Price/subscription), not a self-serve amount. Fulfillment
 *  (raising `companies.job_ad_slot_cap`) happens in the webhook handler,
 *  never here or on the success page — a customer can pay and lose their
 *  connection before ever seeing the success page, and fulfillment must
 *  not depend on that page loading. Reuses the company's existing Stripe
 *  Customer (if a Top Employer subscription already created one) so both
 *  products stay under one Customer — see the webhook's own comment. */
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
      mode: "subscription",
      ...(ctx.company.stripe_customer_id ? { customer: ctx.company.stripe_customer_id } : {}),
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: ctx.company.id,
      subscription_data: { metadata: { company_id: ctx.company.id } },
      integration_identifier: newIntegrationIdentifier("job_ads"),
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

// v2 pricing: flat €500/month, annual = 500×10 ("2 months free") — see
// scripts/stripe-setup.mjs. The superseded top_employer_monthly/
// top_employer_annual Prices are never referenced here anymore, but stay
// provisioned (Prices are immutable) since real subscribers are still on
// them until they churn or are migrated.
const TOP_EMPLOYER_LOOKUP_KEYS = {
  month: "top_employer_monthly_v2",
  year: "top_employer_annual_v2",
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
      ...(ctx.company.stripe_customer_id ? { customer: ctx.company.stripe_customer_id } : {}),
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
 *  rather than reimplementing any of that. `companies.stripe_customer_id`
 *  is the single source of truth for which Customer to open — set once by
 *  the webhook on whichever subscription (job-ads or Top Employer)
 *  activates first, and reused by both, so the portal shows everything a
 *  company has bought regardless of which product got them a Customer.
 *  A company with neither subscription has no portal to open — its
 *  billing history is the purchases list on this same page, not the
 *  portal. Requires a Customer Portal configuration to exist (Stripe
 *  Dashboard → Settings → Billing → Customer portal → Save, a one-time
 *  setup step — see CLAUDE.md), otherwise Stripe itself returns a clear
 *  error. */
export async function createBillingPortalSessionAction(locale: string): Promise<CreatePortalResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "no_subscription" };
  if (!ctx.company.stripe_customer_id) return { ok: false, reason: "no_subscription" };

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: ctx.company.stripe_customer_id,
      return_url: `${SITE}/${locale}/recruit/jobs/ads`,
    });
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("createBillingPortalSessionAction failed:", err);
    return { ok: false, reason: "stripe_error" };
  }
}
