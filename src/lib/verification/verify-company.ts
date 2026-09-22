import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { ViesProvider } from "./vies";

const provider = new ViesProvider();

// 5m, 15m, 1h, 6h, then capped at 24h — a provider outage degrades the
// funnel instead of blocking it (§5.7.4); this just spaces out retries.
const BACKOFF_MINUTES = [5, 15, 60, 360, 1440];

function nextRetryAt(attempts: number): string {
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/**
 * Runs one verification attempt for a company and persists the result.
 * Called right after employer registration (fire-and-forget via `after()`)
 * and lazily whenever a `pending` company's console loads past its
 * `verification_next_retry_at` (§5.7.3, §5.7.4 — no cron needed).
 */
export async function verifyCompany(companyId: string, nif: string) {
  const admin = createAdminClient();
  const result = await provider.lookup(nif);

  if (result.outcome === "found") {
    await admin
      .from("companies")
      .update({
        verification_status: "verified",
        verified_legal_name: result.legalName ?? null,
        verified_at: new Date().toISOString(),
        verification_source: result.source,
        verification_reference: result.reference ?? null,
      })
      .eq("id", companyId);
    await logEvent("employer.verified", { company_id: companyId, source: result.source });
    return;
  }

  if (result.outcome === "not_found") {
    await admin
      .from("companies")
      .update({ verification_status: "failed" })
      .eq("id", companyId);
    return;
  }

  // undetermined: stays pending, back off before the next attempt.
  const { data } = await admin
    .from("companies")
    .select("verification_attempts")
    .eq("id", companyId)
    .single();
  const attempts = (data?.verification_attempts ?? 0) + 1;

  await admin
    .from("companies")
    .update({
      verification_status: "pending",
      verification_attempts: attempts,
      verification_next_retry_at: nextRetryAt(attempts),
    })
    .eq("id", companyId);
}
