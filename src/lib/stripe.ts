import Stripe from "stripe";

// Single client construction point, mirroring the Supabase-client
// convention in this codebase (no central env module — `!`-asserted
// directly at the one call site that needs it, see src/lib/supabase/*).
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/** Stripe's own Checkout Sessions guidance: tag every session with a
 *  short random label so Dashboard checkout-flow comparisons can tell
 *  distinct call sites apart (a required 8-random-letter suffix). */
export function newIntegrationIdentifier(flow: string): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `justit_${flow}_${suffix}`;
}
