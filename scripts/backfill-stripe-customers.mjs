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

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
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
