import { createAdminClient } from "@/lib/supabase/admin";
import { ensureEmployerProfile, DuplicateNifError } from "@/lib/auth/complete-registration";

// One-off: manually runs the real registration-completion function for a
// real user (riadh.chaabouni@itdsportugal.com) whose own confirmation-link
// click never reached it — most likely a corporate email security scanner
// consuming the one-time link before he did (see the 2026-10-25 fix for the
// underlying cause). Calling the actual ensureEmployerProfile (not a
// hand-rolled reimplementation) guarantees the end state is identical to a
// normal successful registration, including it triggering verifyCompany and
// ensureStripeCustomer exactly as it always does — both are safe to call
// outside a request context (their `after()` call throws synchronously
// there, caught by the existing `try { after(...) } catch { void fn() }`
// fallback already in the function, so they still run, just not deferred).

const USER_ID = "ea0ca08e-dca5-478b-9e2d-5c7f33962216";

async function main() {
  const admin = createAdminClient();
  const { data: user, error } = await admin.auth.admin.getUserById(USER_ID);
  if (error || !user?.user) throw error ?? new Error("user not found");

  const meta = user.user.user_metadata ?? {};
  console.log("User:", user.user.email, "pending_nif:", meta.pending_nif, "pending_company_name:", meta.pending_company_name);

  try {
    const { landingPath } = await ensureEmployerProfile(user.user, {
      nif: meta.pending_nif,
      companyName: meta.pending_company_name,
    });
    console.log("Done. landingPath:", landingPath);
  } catch (err) {
    if (err instanceof DuplicateNifError) {
      console.error("DuplicateNifError — a company with this NIF already exists:", err.message);
    } else {
      throw err;
    }
  }
}

main();
