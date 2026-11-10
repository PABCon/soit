import { createAdminClient } from "@/lib/supabase/admin";

// Fixed hiring-pipeline stages (§real-usage request): every company gets
// the same 4-stage pipeline (Applied/Responded/Rejected/Closed), used
// wherever the old fixed application_status enum used to drive the UI.
// The enum column itself (applications.status) is left untouched, a
// frozen historical record. Per-company customization (add/rename/
// reorder/delete your own stage names) was built and then deliberately
// reverted: real-usage feedback was that it added friction nobody wanted
// ("weird that we need to think about it"), so the stage list stays
// fixed, but the underlying stage_id/candidate_bucket plumbing stays
// exactly as built, since that's what fixed the real viewed_at/RLS bugs
// found along the way.
//
// Always reads through the admin client, scoped in application code by
// an explicit companyId, the same admin-client-scoped-in-code discipline
// this project already uses throughout (candidate-matches.ts,
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
 *  existed still gets a real, usable set of stages the moment they need
 *  one, rather than an empty list or a special-cased fallback scattered
 *  across every caller. */
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
