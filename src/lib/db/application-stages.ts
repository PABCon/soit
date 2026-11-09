import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployerContext } from "./companies";

// Custom hiring-pipeline stages (§real-usage request): every company
// gets its own ordered list of stages, used wherever the old fixed
// application_status enum used to drive the UI. The enum column itself
// (applications.status) is left untouched, a frozen historical record.
//
// Always reads/writes through the admin client, scoped in application
// code by an explicit companyId, the same admin-client-scoped-in-code
// discipline this project already uses throughout (candidate-matches.ts,
// applications.ts's own candidate-detail reads). This is required, not
// just a convenience: the apply flow needs a company's initial stage id
// with no employer session at all (a candidate or anonymous applicant
// has no RLS identity for *that* company's own rows), and every other
// caller here has already verified the real companyId through a
// legitimate employer session before calling in, so there's no
// cross-tenant leak risk either way.

export type CandidateBucket = "submitted" | "in_review" | "not_selected" | "hired";

export type ApplicationStage = {
  id: string;
  label: string;
  position: number;
  candidateBucket: CandidateBucket;
};

const DEFAULT_STAGES: { label: string; candidateBucket: CandidateBucket }[] = [
  { label: "Applied", candidateBucket: "submitted" },
  { label: "Responded", candidateBucket: "in_review" },
  { label: "Rejected", candidateBucket: "not_selected" },
  { label: "Closed", candidateBucket: "not_selected" },
];

/** Lazily creates a company's default 4-stage pipeline the first time
 *  anything asks for it: a company that registered before this feature
 *  existed (or simply never visited the pipeline settings page) still
 *  gets a real, usable set of stages the moment they need one, rather
 *  than an empty list or a special-cased fallback scattered across
 *  every caller. */
export async function getOrCreateCompanyStages(companyId: string): Promise<ApplicationStage[]> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("company_application_stages")
    .select("id, label, position, candidate_bucket")
    .eq("company_id", companyId)
    .order("position", { ascending: true });

  if (existing && existing.length > 0) {
    return existing.map((s) => ({ id: s.id, label: s.label, position: s.position, candidateBucket: s.candidate_bucket }));
  }

  const { data: created, error } = await admin
    .from("company_application_stages")
    .insert(DEFAULT_STAGES.map((s, i) => ({ company_id: companyId, label: s.label, position: i, candidate_bucket: s.candidateBucket })))
    .select("id, label, position, candidate_bucket");
  if (error || !created) throw new Error(error?.message ?? "Failed to create default application stages");

  return created
    .map((s) => ({ id: s.id, label: s.label, position: s.position, candidateBucket: s.candidate_bucket }))
    .sort((a, b) => a.position - b.position);
}

/** The stage a brand-new application starts on: whichever stage has the
 *  lowest `position` for that company. No separate "is default" flag to
 *  keep in sync: simpler to keep correct than enforcing "exactly one
 *  flagged row" per company. */
export async function getInitialStageId(companyId: string): Promise<string> {
  const stages = await getOrCreateCompanyStages(companyId);
  return stages[0].id;
}

export type StageMutationResult = { ok: true } | { ok: false; reason: "not_an_employer" | "last_stage" | "stage_in_use" | "not_found" };

export type AddStageResult = { ok: true; stage: ApplicationStage } | { ok: false; reason: "not_an_employer" | "not_found" };

/** Every mutation below re-verifies the caller is a real employer and
 *  re-scopes every write to *their own* companyId, same discipline as
 *  every other employer-write function in this codebase, never trusts
 *  a client-supplied companyId for a write, only for the read-only
 *  helpers above (whose own callers have already verified it). */
export async function addCompanyStage(label: string, candidateBucket: CandidateBucket): Promise<AddStageResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const stages = await getOrCreateCompanyStages(ctx.company.id);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("company_application_stages")
    .insert({ company_id: ctx.company.id, label: label.trim(), position: stages.length, candidate_bucket: candidateBucket })
    .select("id, label, position, candidate_bucket")
    .single();
  if (error || !data) return { ok: false, reason: "not_found" };
  return { ok: true, stage: { id: data.id, label: data.label, position: data.position, candidateBucket: data.candidate_bucket } };
}

export async function renameCompanyStage(stageId: string, label: string, candidateBucket: CandidateBucket): Promise<StageMutationResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("company_application_stages")
    .update({ label: label.trim(), candidate_bucket: candidateBucket })
    .eq("id", stageId)
    .eq("company_id", ctx.company.id);
  if (error) return { ok: false, reason: "not_found" };
  return { ok: true };
}

/** A stage can never be deleted while any real application still points
 *  to it (no orphaned FK, no silent reassignment a company never asked
 *  for), and the last remaining stage can never be deleted at all:
 *  every company needs somewhere for a new application to start. */
export async function deleteCompanyStage(stageId: string): Promise<StageMutationResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const admin = createAdminClient();
  const { count: stageCount } = await admin
    .from("company_application_stages")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctx.company.id);
  if ((stageCount ?? 0) <= 1) return { ok: false, reason: "last_stage" };

  const { count: inUseCount } = await admin
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", stageId);
  if ((inUseCount ?? 0) > 0) return { ok: false, reason: "stage_in_use" };

  const { error } = await admin.from("company_application_stages").delete().eq("id", stageId).eq("company_id", ctx.company.id);
  if (error) return { ok: false, reason: "not_found" };
  return { ok: true };
}

/** Reorders the whole list at once (drag-free: move up/down swaps two
 *  adjacent positions) rather than maintaining a unique constraint on
 *  `position` that a two-row swap would transiently violate, the simplest
 *  robust approach at the scale of a handful of stages per company. */
export async function reorderCompanyStages(orderedStageIds: string[]): Promise<StageMutationResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const admin = createAdminClient();
  const results = await Promise.all(
    orderedStageIds.map((id, position) =>
      admin.from("company_application_stages").update({ position }).eq("id", id).eq("company_id", ctx.company.id),
    ),
  );
  if (results.some((r) => r.error)) return { ok: false, reason: "not_found" };
  return { ok: true };
}
