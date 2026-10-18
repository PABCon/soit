import { createAdminClient } from "@/lib/supabase/admin";

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

type PurgeResult = {
  applicationsPurged: number;
  applicationCvFilesRemoved: number;
  unclaimedCandidatesPurged: number;
};

/**
 * §6.6 of the build spec: "applications and their CV snapshots are deleted
 * 12 months after `status_updated_at`; unclaimed `candidates` rows with no
 * live applications are deleted after 12 months. Implement as a scheduled
 * purge — this is the one place a cron is genuinely required."
 *
 * Two independent passes, in this order:
 *
 * 1. Applications whose `status_updated_at` is >12 months old: the storage
 *    object at each row's own `cv_url` (a per-application snapshot, never
 *    shared with the candidate's master CV) is removed first — row deletion
 *    doesn't cascade-delete the actual file, same gotcha this project has
 *    hit for every other upload path — then the row itself is hard-deleted,
 *    exactly as the spec says ("deleted," not anonymized; unlike the
 *    separate, already-built candidate-initiated self-service deletion in
 *    `candidate-profile.ts`, which anonymizes rather than deletes
 *    specifically so an employer's own hiring record survives — that
 *    tension doesn't apply here since the *application itself* is what's
 *    being retired this time, not a candidate who might still have other
 *    live applications elsewhere).
 *
 * 2. Unclaimed candidates (`auth_user_id is null` — created via the
 *    account-free apply flow, §6.7/v1.11, and never claimed by a real
 *    registration) that are themselves >12 months old (the spec names no
 *    specific trigger column for this half, unlike applications'
 *    `status_updated_at`; `candidates.created_at` is used here as the
 *    natural reading of "the record's own age") AND currently have zero
 *    application rows — checked with a real count query, not inferred from
 *    pass 1, since `applications.candidate_id references candidates(id) on
 *    delete cascade` would otherwise silently destroy a *live* application
 *    the moment its candidate row was deleted. A row with even one
 *    remaining (non-purged) application is left alone, by design: it still
 *    has "live applications," which the spec's own wording treats as the
 *    reason to keep it.
 */
export async function runRetentionPurge(): Promise<PurgeResult> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - TWELVE_MONTHS_MS).toISOString();

  // Pass 1: applications + their CV snapshots.
  const { data: staleApplications, error: appsFetchError } = await admin
    .from("applications")
    .select("id, cv_url")
    .lt("status_updated_at", cutoff);
  if (appsFetchError) throw appsFetchError;

  let applicationCvFilesRemoved = 0;
  for (const app of staleApplications ?? []) {
    const { error: removeError } = await admin.storage.from("cvs").remove([app.cv_url]);
    // A missing file (already gone, or never fully uploaded) must never
    // block the row's own deletion below — the row is the record of
    // record here, the file is best-effort cleanup.
    if (!removeError) applicationCvFilesRemoved++;
  }

  let applicationsPurged = 0;
  if (staleApplications && staleApplications.length > 0) {
    const { error: deleteError, count } = await admin
      .from("applications")
      .delete({ count: "exact" })
      .lt("status_updated_at", cutoff);
    if (deleteError) throw deleteError;
    applicationsPurged = count ?? 0;
  }

  // Pass 2: unclaimed candidates with zero remaining applications.
  const { data: staleCandidates, error: candFetchError } = await admin
    .from("candidates")
    .select("id")
    .is("auth_user_id", null)
    .lt("created_at", cutoff);
  if (candFetchError) throw candFetchError;

  let unclaimedCandidatesPurged = 0;
  for (const candidate of staleCandidates ?? []) {
    const { count: liveApplicationCount, error: countError } = await admin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", candidate.id);
    if (countError) throw countError;
    if ((liveApplicationCount ?? 0) > 0) continue;

    const { error: deleteCandidateError } = await admin.from("candidates").delete().eq("id", candidate.id);
    if (deleteCandidateError) throw deleteCandidateError;
    unclaimedCandidatesPurged++;
  }

  return { applicationsPurged, applicationCvFilesRemoved, unclaimedCandidatesPurged };
}
