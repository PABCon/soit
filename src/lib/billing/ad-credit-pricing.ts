/**
 * §pricing — the self-serve job-ad volume curve, for quantities beyond the
 * four fixed packs (1/2/3/5, immutable live Stripe Prices — see
 * scripts/stripe-setup.mjs). A custom quantity (6-200) prices itself off
 * this exact formula rather than a new fixed tier per size.
 *
 * `pricePerAd(n) = FLOOR + AMP * n^(-K)` — a power-law decay toward a
 * floor, with the three constants solved EXACTLY (not fitted/approximated)
 * from three real, known prices rather than assumed:
 *   n=1   -> €59.00    (the live job_ad_credits_1 Price)
 *   n=5   -> €34.00    (the live job_ad_credits_5 Price, per-ad: 170/5)
 *   n=200 -> €2,000.00 (ITDS's real negotiated TOTAL at their actual
 *                        ~200 ads/month, i.e. €10.00/ad — corrected from
 *                        an earlier, wrong reading of this same fact as
 *                        "€20/ad," which implied a €4,000 total instead)
 * Solving `FLOOR + AMP*1^-K = 59`, `FLOOR + AMP*5^-K = 34`, and
 * `FLOOR + AMP*200^-K = 10` simultaneously gives the constants below —
 * re-derive them the same way (see this file's own git history for the
 * worked Python solve) if any of those three anchors ever change for real
 * business reasons; never hand-tune them to make a number "look nicer."
 */
const FLOOR = 0.8660330883293073;
const AMP = 58.13396691167069;
const K = 0.34930901665715514;

/** Below this, buy a fixed pack instead (job_ad_credits_1/2/3/5) — the
 *  curve is really only meant to extend beyond them, not replace them. */
export const AD_CREDIT_CUSTOM_MIN_QTY = 6;
/** Above this, it's a real "talk to sales" custom deal, not a self-serve
 *  one — a Price created by hand in the Stripe Dashboard, same as any
 *  other enterprise plan (see createAdCreditCheckoutAction's own doc). */
export const AD_CREDIT_CUSTOM_MAX_QTY = 200;

export function isValidCustomAdCreditQty(n: number): boolean {
  return Number.isInteger(n) && n >= AD_CREDIT_CUSTOM_MIN_QTY && n <= AD_CREDIT_CUSTOM_MAX_QTY;
}

/** Real-valued, unrounded — for display math only (e.g. showing "€X/ad"
 *  alongside the rounded total). Never sent to Stripe directly. */
export function pricePerAdEur(n: number): number {
  return FLOOR + AMP * Math.pow(n, -K);
}

/** The only place this curve's output turns into money that's actually
 *  charged: one multiplication, rounded to the nearest cent exactly once
 *  at the end — never round pricePerAdEur() first and multiply after,
 *  which would compound n separate roundings into the total instead of
 *  one. */
export function totalPriceEurCents(n: number): number {
  return Math.round(pricePerAdEur(n) * n * 100);
}
