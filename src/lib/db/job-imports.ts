import { createAdminClient } from "@/lib/supabase/admin";
import type { DiscoveredJobLink } from "@/lib/ai/extract-job-links";

export const BATCH_SIZE = 10;
export const RESCAN_COOLDOWN_HOURS = 24;
// How long a `running` import can go with no progress before the daily
// safety-net cron treats it as stalled and resumes it itself.
export const STALL_THRESHOLD_MINUTES = 30;
// Give up for good after this many consecutive stalled-resume attempts —
// protects against retrying an import that's broken in some way that
// resuming can never fix (a dead source URL, a persistent extraction
// failure) forever.
export const MAX_STALLED_RESUMES = 3;

export type JobImportRun = {
  id: string;
  company_id: string;
  source_url: string;
  status: "running" | "completed" | "failed";
  discovered_links: DiscoveredJobLink[];
  next_index: number;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  stalled_resumes: number;
  last_progress_at: string;
  created_at: string;
  completed_at: string | null;
};

/** Whether this company can start a brand-new discovery scan right now —
 *  never while one is already `running` (nothing useful a second scan
 *  could do), and not within RESCAN_COOLDOWN_HOURS of its last scan
 *  (the one step that always costs money, scan outcome or not — see
 *  JobImportCard's own comment for why the per-batch continuation itself
 *  needs no equivalent cooldown). */
export async function canStartJobImport(
  companyId: string,
): Promise<{ ok: true } | { ok: false; reason: "already_running" | "cooldown"; retryAfter?: string }> {
  const admin = createAdminClient();
  const { data: runs } = await admin
    .from("job_import_runs")
    .select("status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = runs?.[0];
  if (!latest) return { ok: true };
  if (latest.status === "running") return { ok: false, reason: "already_running" };

  const cooldownEnds = new Date(new Date(latest.created_at).getTime() + RESCAN_COOLDOWN_HOURS * 3600e3);
  if (cooldownEnds.getTime() > Date.now()) {
    return { ok: false, reason: "cooldown", retryAfter: cooldownEnds.toISOString() };
  }
  return { ok: true };
}

export async function getActiveImportRun(companyId: string): Promise<JobImportRun | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("job_import_runs")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "running")
    .maybeSingle();
  return data as JobImportRun | null;
}

export async function getLatestImportRun(companyId: string): Promise<JobImportRun | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("job_import_runs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as JobImportRun | null;
}

export async function getImportRun(runId: string): Promise<JobImportRun | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("job_import_runs").select("*").eq("id", runId).maybeSingle();
  return data as JobImportRun | null;
}

export async function createImportRun(
  companyId: string,
  sourceUrl: string,
  links: DiscoveredJobLink[],
): Promise<JobImportRun> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("job_import_runs")
    .insert({ company_id: companyId, source_url: sourceUrl, discovered_links: links })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as JobImportRun;
}

/** How many more jobs this run is allowed to create in total — the
 *  company's current job-ad slot cap, minus every job this feature has
 *  ever successfully created for them (across every past run, not just
 *  this one — re-scanning the same or a different page never pushes a
 *  company past what their plan actually allows). */
export async function remainingImportBudget(companyId: string, slotCap: number): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("job_import_sources")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  return Math.max(0, slotCap - (count ?? 0));
}

export async function isSourceAlreadyImported(companyId: string, sourceUrl: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("job_import_sources")
    .select("id")
    .eq("company_id", companyId)
    .eq("source_url", sourceUrl)
    .maybeSingle();
  return !!data;
}

export async function recordImportedSource(companyId: string, sourceUrl: string, jobId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("job_import_sources").insert({ company_id: companyId, source_url: sourceUrl, job_id: jobId });
}

export async function advanceImportRun(
  runId: string,
  updates: { nextIndex: number; importedDelta: number; skippedDelta: number; failedDelta: number },
): Promise<void> {
  const admin = createAdminClient();
  const { data: run } = await admin
    .from("job_import_runs")
    .select("imported_count, skipped_count, failed_count")
    .eq("id", runId)
    .single();
  await admin
    .from("job_import_runs")
    .update({
      next_index: updates.nextIndex,
      imported_count: (run?.imported_count ?? 0) + updates.importedDelta,
      skipped_count: (run?.skipped_count ?? 0) + updates.skippedDelta,
      failed_count: (run?.failed_count ?? 0) + updates.failedDelta,
      last_progress_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export async function completeImportRun(runId: string, status: "completed" | "failed"): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("job_import_runs")
    .update({ status, completed_at: new Date().toISOString() })
    .eq("id", runId);
}

export async function incrementStalledResumes(runId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: run } = await admin.from("job_import_runs").select("stalled_resumes").eq("id", runId).single();
  const next = (run?.stalled_resumes ?? 0) + 1;
  await admin.from("job_import_runs").update({ stalled_resumes: next }).eq("id", runId);
  return next;
}

/** The safety net's own query — a `running` import whose last_progress_at
 *  is older than STALL_THRESHOLD_MINUTES means its self-chain broke
 *  somewhere (the "trigger the next batch" step itself failed) rather
 *  than it still being mid-batch. */
export async function getStalledImportRuns(): Promise<JobImportRun[]> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STALL_THRESHOLD_MINUTES * 60_000).toISOString();
  const { data } = await admin.from("job_import_runs").select("*").eq("status", "running").lt("last_progress_at", cutoff);
  return (data ?? []) as JobImportRun[];
}

/** Same lookup `applications.ts`/the Stripe webhook already use elsewhere
 *  for "who should a company-level notification actually go to." */
export async function resolveCompanyRecipient(companyId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: members } = await admin.from("employer_users").select("auth_user_id").eq("company_id", companyId).limit(1);
  const authUserId = members?.[0]?.auth_user_id;
  if (!authUserId) return null;
  const { data } = await admin.auth.admin.getUserById(authUserId);
  return data.user?.email ?? null;
}
