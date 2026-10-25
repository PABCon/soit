import { createClient } from "@supabase/supabase-js";
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

// A real production incident (2026-10-25) this guard prevents from
// repeating: .env.local's STRIPE_SECRET_KEY is deliberately the sandbox
// key for safe local dev — running this script unmodified would silently
// create Customers nobody in the real account can ever see, against
// companies whose stripe_customer_id then points at a sandbox record. Pass
// the real live key explicitly: `STRIPE_SECRET_KEY=sk_live_... node
// scripts/backfill-stripe-customers.mjs`.
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey?.startsWith("sk_live_")) {
  console.error(
    "Refusing to run: pass the real live secret key explicitly, e.g.\n  STRIPE_SECRET_KEY=sk_live_... node scripts/backfill-stripe-customers.mjs\n(.env.local's own key is the sandbox one, not the real account.)",
  );
  process.exit(1);
}

const stripe = new Stripe(stripeKey);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// One-off backfill for any company created before ensureStripeCustomer
// existed — every company going forward gets a real Stripe Customer at
// registration (src/lib/auth/complete-registration.ts), tagged with
// metadata.company_id so the webhook can resolve a Dashboard-created
// subscription back to the right company. Safe to re-run: skips any
// company that already has stripe_customer_id set.
const { data: companies, error } = await admin
  .from("companies")
  .select("id, company_name")
  .is("stripe_customer_id", null);
if (error) throw error;

console.log(`${companies.length} companies without a Stripe Customer.`);
for (const company of companies) {
  const customer = await stripe.customers.create({
    name: company.company_name,
    metadata: { company_id: company.id },
  });
  const { error: updateError } = await admin
    .from("companies")
    .update({ stripe_customer_id: customer.id })
    .eq("id", company.id);
  if (updateError) {
    console.error(`  FAILED to save stripe_customer_id for ${company.company_name}:`, updateError.message);
    continue;
  }
  console.log(`  ${company.company_name}: ${customer.id}`);
}
