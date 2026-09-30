"use server";

import { stripe, newIntegrationIdentifier } from "@/lib/stripe";
import { getMyEmployerContext } from "@/lib/db/companies";

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

export type CreateCheckoutResult = { ok: true; url: string } | { ok: false; reason: "not_an_employer" | "price_not_found" };

/** Self-serve job-ad credit purchase (§pricing) — one-time Stripe Checkout,
 *  `mode: "payment"`. 6+ packs are deliberately not offered here at all —
 *  that's the "talk to sales" path (a contact form + a manually-created
 *  Stripe invoice/subscription), not a self-serve amount. Fulfillment
 *  (crediting `companies.ad_credits_available`) happens in the webhook
 *  handler, never here or on the success page — a customer can pay and
 *  lose their connection before ever seeing the success page, and
 *  fulfillment must not depend on that page loading. */
export async function createAdCreditCheckoutAction(quantity: AdCreditPackSize): Promise<CreateCheckoutResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

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
    success_url: `${SITE}/recruit/jobs/ads?purchase=success`,
    cancel_url: `${SITE}/recruit/jobs/ads?purchase=canceled`,
  });

  return { ok: true, url: session.url! };
}
