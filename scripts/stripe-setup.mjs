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
const JOB_AD_PRICES = [
  { lookup_key: "job_ad_credits_1", quantity: 1, unit_amount: 5900 },
  { lookup_key: "job_ad_credits_2", quantity: 2, unit_amount: 9000 },
  { lookup_key: "job_ad_credits_3", quantity: 3, unit_amount: 11700 },
  { lookup_key: "job_ad_credits_5", quantity: 5, unit_amount: 17000 },
];

const TOP_EMPLOYER_PRICES = [
  { lookup_key: "top_employer_monthly", unit_amount: 58500, interval: "month" },
  { lookup_key: "top_employer_annual", unit_amount: 596700, interval: "year" },
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
  "One-time job-ad credit packs — each credit is redeemable for one 30-day job posting.",
);
for (const spec of JOB_AD_PRICES) {
  const price = await findOrCreatePrice(adProduct, spec);
  console.log(`job_ad_credits_${spec.quantity}: ${price.id} (${price.lookup_key})`);
}

const topEmployerProduct = await findOrCreateProduct(
  "Top Employer",
  "Badge, site-wide sponsor placement, unlimited bumps, full rich company profile, API access, and 10 bundled job-ad slots.",
);
for (const spec of TOP_EMPLOYER_PRICES) {
  const price = await findOrCreatePrice(topEmployerProduct, spec, {
    recurring: { interval: spec.interval },
  });
  console.log(`${spec.lookup_key}: ${price.id}`);
}
