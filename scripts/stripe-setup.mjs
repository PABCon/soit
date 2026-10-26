import Stripe from "stripe";
import fs from "fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"(.*)"$/, "$1")];
    }),
);

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// Idempotent: one Product per genuinely distinct plan (Stripe's own
// guidance — different tiers must not share a Product, since every
// Checkout/invoice line item just shows the Product name), Prices as
// billing variants within each, referenced everywhere else by
// `lookup_key` rather than a hardcoded Price ID.
//
// §pricing: recurring monthly, not one-time — paying keeps up to
// `quantity` job ads live at once, for as long as the subscription stays
// active (not a spend-down balance). `job_ad_slots` metadata is what the
// webhook reads to know how many slots a given Price grants — a custom
// enterprise deal (e.g. 200 slots) just needs its own Price with that same
// field set, created directly in the Stripe Dashboard; no code change
// here or in the webhook for a new custom tier.
const JOB_AD_PRICES = [
  { lookup_key: "job_ad_credits_1", quantity: 1, unit_amount: 5900 },
  { lookup_key: "job_ad_credits_2", quantity: 2, unit_amount: 9000 },
  { lookup_key: "job_ad_credits_3", quantity: 3, unit_amount: 11700 },
  { lookup_key: "job_ad_credits_5", quantity: 5, unit_amount: 17000 },
];

// Superseded by top_employer_monthly_v2/top_employer_annual_v2 below
// (flat €500/mo, no bundled job-ad slots) — kept here, unmodified, only
// because real subscribers are still billed on these exact Prices.
// Prices are immutable in Stripe; never edit the amounts below.
const TOP_EMPLOYER_PRICES = [
  { lookup_key: "top_employer_monthly", unit_amount: 58500, interval: "month" },
  { lookup_key: "top_employer_annual", unit_amount: 596700, interval: "year" },
];

// Superseded by top_employer_monthly_v3/top_employer_annual_v3 below (the
// €2,500/year repricing) — kept here, unmodified, only because real
// subscribers are still billed on these exact Prices. Prices are immutable
// in Stripe; never edit the amounts below.
const TOP_EMPLOYER_PRICES_V2 = [
  { lookup_key: "top_employer_monthly_v2", unit_amount: 50000, interval: "month" },
  { lookup_key: "top_employer_annual_v2", unit_amount: 500000, interval: "year" },
];

// Current pricing: €2,500/year is the real anchor now, not a monthly rate
// discounted for paying annually — monthly is just that annual price
// divided by 12 (€208.33), so the two billing cadences cost the same
// total per year instead of monthly being a markup over annual.
const TOP_EMPLOYER_PRICES_V3 = [
  { lookup_key: "top_employer_monthly_v3", unit_amount: 20833, interval: "month" },
  { lookup_key: "top_employer_annual_v3", unit_amount: 250000, interval: "year" },
];

async function findOrCreateProduct(name, description) {
  const existing = await stripe.products.search({ query: `name:"${name}" AND active:"true"` });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({ name, description });
}

async function findOrCreatePrice(product, spec, extra = {}) {
  const existing = await stripe.prices.list({ lookup_keys: [spec.lookup_key], limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: spec.unit_amount,
    lookup_key: spec.lookup_key,
    ...extra,
  });
}

const adProduct = await findOrCreateProduct(
  "Job Ad Credits",
  "Recurring monthly job-ads plans — keep up to N job ads live at once for as long as the subscription is active.",
);
for (const spec of JOB_AD_PRICES) {
  const price = await findOrCreatePrice(adProduct, spec, {
    recurring: { interval: "month" },
    metadata: { job_ad_slots: String(spec.quantity) },
  });
  console.log(`job_ad_credits_${spec.quantity}: ${price.id} (${price.lookup_key})`);
}

const topEmployerProduct = await findOrCreateProduct(
  "Top Employer",
  "Badge, site-wide sponsor placement, unlimited bumps, full rich company profile, and API access. Job-ad slots are purchased separately, same as any verified company.",
);
for (const spec of [...TOP_EMPLOYER_PRICES, ...TOP_EMPLOYER_PRICES_V2, ...TOP_EMPLOYER_PRICES_V3]) {
  const price = await findOrCreatePrice(topEmployerProduct, spec, {
    recurring: { interval: spec.interval },
  });
  console.log(`${spec.lookup_key}: ${price.id}`);
}
