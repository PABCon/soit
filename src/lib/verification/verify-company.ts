import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { ViesProvider } from "./vies";
import { NifPtProvider } from "./nifpt";

const viesProvider = new ViesProvider();
const nifPtProvider = new NifPtProvider();

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
  let result = await viesProvider.lookup(nif);

  // VIES structurally misses domestic-only Portuguese companies (it only
  // covers intra-EU VAT enrollment) — nif.pt queries the real PT registry,
  // so it's a decisive fallback whenever VIES itself didn't resolve.
  if (result.outcome !== "found") {
    const fallback = await nifPtProvider.lookup(nif);
    if (fallback.outcome === "found" || fallback.outcome === "not_found") {
      result = fallback;
    }
  }

  if (result.outcome === "found") {
    const update: Record<string, unknown> = {
      verification_status: "verified",
      verified_legal_name: result.legalName ?? null,
      verified_at: new Date().toISOString(),
      verification_source: result.source,
      verification_reference: result.reference ?? null,
    };

    // Prefill address/location from the registry record — only ever into
    // an empty field. This runs both right after registration (address is
    // always empty then) and lazily on a later retry for a `pending`
    // company, by which point the employer may already have typed their
    // own address in — never clobber that.
    if (result.address || result.city) {
      const { data: existing } = await admin
        .from("companies")
        .select("address, location_id")
        .eq("id", companyId)
        .single();

      if (result.address && !existing?.address) update.address = result.address;

      if (result.city && !existing?.location_id) {
        const { data: location } = await admin
          .from("locations")
          .select("id")
          .ilike("name", result.city.trim())
          .limit(1)
          .maybeSingle();
        if (location) update.location_id = location.id;
      }
    }

    await admin.from("companies").update(update).eq("id", companyId);
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
