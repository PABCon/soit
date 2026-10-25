import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Single client construction point, mirroring the Supabase-client
// convention in this codebase (no central env module — `!`-asserted
// directly at the one call site that needs it, see src/lib/supabase/*).
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/** Every company gets a real Stripe Customer the moment it registers, not
 *  lazily on first payment — so any company (paying yet or not) can be
 *  found and billed directly from the Stripe Dashboard: search Customers
 *  by name, pick one, create a subscription against any Price (a custom
 *  enterprise deal included), no Checkout flow or client_reference_id
 *  needed. `metadata.company_id` is what lets the webhook resolve a
 *  Dashboard-created subscription back to a company even though it never
 *  went through our own Checkout Session — see the webhook's own
 *  `resolveCompanyId` for the other half of this.
 *
 *  Best-effort and non-blocking: called via the same `after()`-then-
 *  fire-and-forget pattern `verifyCompany` already uses, so a Stripe
 *  outage can never break registration itself. Safe to call again later
 *  (a backfill script does, for any company created before this existed)
 *  — short-circuits once `stripe_customer_id` is already set. */
export async function ensureStripeCustomer(companyId: string, companyName: string, email: string | null): Promise<void> {
  const admin = createAdminClient();
  const { data: company } = await admin.from("companies").select("stripe_customer_id").eq("id", companyId).maybeSingle();
  if (!company || company.stripe_customer_id) return;

  try {
    const customer = await stripe.customers.create({
      name: companyName,
      ...(email ? { email } : {}),
      metadata: { company_id: companyId },
    });
    await admin.from("companies").update({ stripe_customer_id: customer.id }).eq("id", companyId);
  } catch (err) {
    console.error("ensureStripeCustomer failed:", (err as Error).message);
  }
}

/** Stripe's own Checkout Sessions guidance: tag every session with a
 *  short random label so Dashboard checkout-flow comparisons can tell
 *  distinct call sites apart (a required 8-random-letter suffix). */
export function newIntegrationIdentifier(flow: string): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `justit_${flow}_${suffix}`;
}
