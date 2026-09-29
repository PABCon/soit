import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffFileType } from "@/lib/file-sniff";
import type { SkillLevel } from "@/lib/types";

export type CandidateProfile = {
  fullName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  hasCv: boolean;
  cvPromptDismissed: boolean;
};

/** RLS already scopes this to the caller's own row (`auth_user_id =
 *  auth.uid()`) — same pattern as `getMyApplications` in applications.ts,
 *  no explicit filter needed. `skills` deliberately isn't read here any
 *  more (§ AI Pieces backlog, profile-depth phase) — it's a derived cache
 *  column now, recomputed by `saveCandidateSkills`, never hand-edited via
 *  this form. */
export async function getMyCandidateProfile(): Promise<CandidateProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidates")
    .select("full_name, email, phone, linkedin_url, avatar_url, cv_url, cv_prompt_dismissed")
    .maybeSingle();

  if (!data) return null;
  return {
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    linkedinUrl: data.linkedin_url,
    avatarUrl: data.avatar_url,
    hasCv: !!data.cv_url,
    cvPromptDismissed: data.cv_prompt_dismissed,
  };
}

/** First-login CV prompt (§ AI Pieces backlog, phase 4): "seen it" is
 *  permanent regardless of whether the candidate ends up uploading later —
 *  the prompt's other suppression condition (`hasCv`) already covers that
 *  case on its own. */
export async function dismissCvPrompt(): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return;
  await supabase.from("candidates").update({ cv_prompt_dismissed: true }).eq("id", candidateId);
}

export async function updateCandidateProfile(fields: {
  full_name: string;
  phone: string | null;
  linkedin_url: string | null;
}) {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");
  // PostgREST requires an explicit filter on UPDATE regardless of RLS —
  // an unscoped .update() is rejected outright ("UPDATE requires a WHERE
  // clause"), it doesn't just implicitly rely on the RLS policy.
  const { error } = await supabase.from("candidates").update(fields).eq("id", candidateId);
  if (error) throw new Error(error.message);
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_CV_BYTES = 5 * 1024 * 1024; // matches applications.ts's per-application cap, §6.7

export type UploadResult =
  | { ok: true }
  | { ok: false; reason: "not_a_candidate" | "file_too_large" | "bad_file" | "upload_failed" };

export async function uploadCandidateAvatar(file: File): Promise<UploadResult> {
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, reason: "file_too_large" };
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return { ok: false, reason: "bad_file" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_a_candidate" };

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error } = await supabase
    .from("candidates")
    .update({ avatar_url: `${publicUrl.publicUrl}?v=${Date.now()}` })
    .eq("auth_user_id", user.id);
  if (error) return { ok: false, reason: "upload_failed" };

  return { ok: true };
}

/** A *master* CV, distinct from the per-application CVs `applyToJob`/
 *  `applyAnonymously` handle (src/lib/db/applications.ts) — same content-
 *  sniffing + size cap, duplicated rather than imported since that
 *  helper's path is job-scoped and this one isn't; it's ~10 lines, not
 *  worth forcing a shared abstraction over. */
export async function uploadCandidateCv(file: File): Promise<UploadResult> {
  if (file.size === 0 || file.size > MAX_CV_BYTES) return { ok: false, reason: "file_too_large" };

  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffFileType(bytes);
  if (!kind) return { ok: false, reason: "bad_file" };

  const path = `${candidateId}/profile-cv.${kind}`;
  const contentType =
    kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // The cvs bucket has no client policies at all (private, §6.3) — the
  // admin client is required here, same as every other CV write.
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from("cvs").upload(path, bytes, {
    upsert: true,
    contentType,
  });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { error } = await supabase.from("candidates").update({ cv_url: path }).eq("id", candidateId);
  if (error) return { ok: false, reason: "upload_failed" };

  return { ok: true };
}

/** Same 15-minute signed-URL pattern already used for employer CV access
 *  in `getApplicantsForJob` (applications.ts). */
export async function getMyCvSignedUrl(): Promise<string | null> {
  const supabase = await createClient();
  const { data: candidate } = await supabase.from("candidates").select("cv_url").maybeSingle();
  if (!candidate?.cv_url) return null;

  const admin = createAdminClient();
  const { data: signed } = await admin.storage.from("cvs").createSignedUrl(candidate.cv_url, 900);
  return signed?.signedUrl ?? null;
}

// ── CV-upload profile autofill: skills, languages, education ────────────────
// §AI Pieces backlog, phase 1. candidate_tech_tags/candidate_languages
// deliberately reuse the exact tech_tags/spoken_languages vocabulary the
// job side already uses (job_tech_tags/job_languages) — same vocabulary on
// both sides is what will let a future matching engine compare them at all.

export type CandidateTechTag = { techTagId: string; label: string; level: SkillLevel | null };
export type CandidateLanguage = { spokenLanguageId: string; label: string; level: SkillLevel | null };
export type CandidateEducationEntry = {
  id: string;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
};

export type CandidateSkillsAndEducation = {
  headline: string | null;
  yearsExperience: number | null;
  techTags: CandidateTechTag[];
  languages: CandidateLanguage[];
  education: CandidateEducationEntry[];
};

export async function getMyCandidateSkillsAndEducation(): Promise<CandidateSkillsAndEducation | null> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return null;

  const [{ data: base }, { data: techRows }, { data: langRows }, { data: eduRows }] = await Promise.all([
    supabase.from("candidates").select("headline, years_experience").eq("id", candidateId).maybeSingle(),
    supabase
      .from("candidate_tech_tags")
      .select("tech_tag_id, level, tech_tags ( label )")
      .eq("candidate_id", candidateId),
    supabase
      .from("candidate_languages")
      .select("spoken_language_id, level, spoken_languages ( label )")
      .eq("candidate_id", candidateId),
    supabase
      .from("candidate_education")
      .select("id, institution, degree, field_of_study, start_date, end_date, note")
      .eq("candidate_id", candidateId)
      .order("start_date", { ascending: false, nullsFirst: false }),
  ]);

  return {
    headline: base?.headline ?? null,
    yearsExperience: base?.years_experience ?? null,
    techTags: (techRows ?? []).map((r) => ({
      techTagId: r.tech_tag_id,
      label: (r.tech_tags as unknown as { label: string } | null)?.label ?? "",
      level: r.level,
    })),
    languages: (langRows ?? []).map((r) => ({
      spokenLanguageId: r.spoken_language_id,
      label: (r.spoken_languages as unknown as { label: string } | null)?.label ?? "",
      level: r.level,
    })),
    education: (eduRows ?? []).map((r) => ({
      id: r.id,
      institution: r.institution,
      degree: r.degree,
      fieldOfStudy: r.field_of_study,
      startDate: r.start_date,
      endDate: r.end_date,
      note: r.note,
    })),
  };
}

export type CandidateEducationInput = {
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
};

/** §AI Pieces backlog, profile-depth phase — split from the original
 *  single `saveCandidateSkillsAndEducation` into independent, narrow
 *  functions, one per profile section, so the tabbed profile UI's
 *  per-section "Save changes" button can touch only its own data. Each
 *  still requires its own `my_candidate_id()` lookup (RLS + PostgREST's
 *  own "UPDATE requires an explicit filter" rule, same as
 *  `updateCandidateProfile`) — small, deliberate duplication over a
 *  shared "get candidateId or throw" helper that would just move the
 *  same four lines around. */

export async function saveCandidateBasics(headline: string | null, yearsExperience: number | null): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");
  await supabase
    .from("candidates")
    .update({ headline, years_experience: yearsExperience })
    .eq("id", candidateId);
}

/** Delete-then-reinsert, same idiom `saveJob` already uses for
 *  `job_tech_tags`. Also recomputes `candidates.skills` (the flat label
 *  array) from the tags just saved — every existing reader of that
 *  column (Applicant/CompanyApplicant) keeps working with zero call-site
 *  changes; it's a derived cache now, never hand-edited directly. */
export async function saveCandidateSkills(entries: { techTagId: string; level: SkillLevel | null }[]): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  await supabase.from("candidate_tech_tags").delete().eq("candidate_id", candidateId);
  if (entries.length > 0) {
    await supabase.from("candidate_tech_tags").insert(
      entries.map((t) => ({ candidate_id: candidateId, tech_tag_id: t.techTagId, level: t.level })),
    );
  }

  let labels: string[] = [];
  if (entries.length > 0) {
    const { data: tags } = await supabase
      .from("tech_tags")
      .select("id, label")
      .in(
        "id",
        entries.map((t) => t.techTagId),
      );
    labels = (tags ?? []).map((t) => t.label);
  }
  await supabase.from("candidates").update({ skills: labels }).eq("id", candidateId);
}

export async function saveCandidateLanguages(
  entries: { spokenLanguageId: string; level: SkillLevel | null }[],
): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  await supabase.from("candidate_languages").delete().eq("candidate_id", candidateId);
  if (entries.length > 0) {
    await supabase.from("candidate_languages").insert(
      entries.map((l) => ({
        candidate_id: candidateId,
        spoken_language_id: l.spokenLanguageId,
        level: l.level,
      })),
    );
  }
}

export async function saveCandidateEducation(entries: CandidateEducationInput[]): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  await supabase.from("candidate_education").delete().eq("candidate_id", candidateId);
  if (entries.length > 0) {
    await supabase.from("candidate_education").insert(
      entries.map((e) => ({
        candidate_id: candidateId,
        institution: e.institution,
        degree: e.degree,
        field_of_study: e.fieldOfStudy,
        start_date: e.startDate,
        end_date: e.endDate,
        note: e.note,
      })),
    );
  }
}

// ── Experience, certifications, job preferences ──────────────────────────────
// §AI Pieces backlog, profile-depth phase (real-usage feedback: work
// history and certifications weren't captured at all; no way to scope a
// future recommendation engine's matches without stated preferences).

export type CandidateExperienceEntry = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
};
export type CandidateExperienceInput = {
  title: string;
  company: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
};

export async function getMyCandidateExperience(): Promise<CandidateExperienceEntry[]> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return [];
  const { data } = await supabase
    .from("candidate_experience")
    .select("id, title, company, location, start_date, end_date, description")
    .eq("candidate_id", candidateId)
    .order("start_date", { ascending: false, nullsFirst: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    location: r.location,
    startDate: r.start_date,
    endDate: r.end_date,
    description: r.description,
  }));
}

export async function saveCandidateExperience(entries: CandidateExperienceInput[]): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  await supabase.from("candidate_experience").delete().eq("candidate_id", candidateId);
  if (entries.length > 0) {
    await supabase.from("candidate_experience").insert(
      entries.map((e) => ({
        candidate_id: candidateId,
        title: e.title,
        company: e.company,
        location: e.location,
        start_date: e.startDate,
        end_date: e.endDate,
        description: e.description,
      })),
    );
  }
}

export type CandidateCertificationEntry = {
  id: string;
  name: string;
  issuer: string | null;
  issuedDate: string | null;
};
export type CandidateCertificationInput = {
  name: string;
  issuer: string | null;
  issuedDate: string | null;
};

export async function getMyCandidateCertifications(): Promise<CandidateCertificationEntry[]> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return [];
  const { data } = await supabase
    .from("candidate_certifications")
    .select("id, name, issuer, issued_date")
    .eq("candidate_id", candidateId)
    .order("issued_date", { ascending: false, nullsFirst: false });
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, issuer: r.issuer, issuedDate: r.issued_date }));
}

export async function saveCandidateCertifications(entries: CandidateCertificationInput[]): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  await supabase.from("candidate_certifications").delete().eq("candidate_id", candidateId);
  if (entries.length > 0) {
    await supabase.from("candidate_certifications").insert(
      entries.map((c) => ({
        candidate_id: candidateId,
        name: c.name,
        issuer: c.issuer,
        issued_date: c.issuedDate,
      })),
    );
  }
}

export type WorkModelPreference = "remote" | "hybrid" | "office";
export type EmploymentTypePreference = "permanent" | "fixed_term" | "contractor" | "freelance" | "internship";
export type SalaryPeriodPreference = "hour" | "day" | "month" | "year";

export type CandidateJobPreferences = {
  categoryIds: string[];
  locationIds: string[];
  workModel: WorkModelPreference | null;
  employmentType: EmploymentTypePreference | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriodPreference | null;
};

export async function getMyCandidateJobPreferences(): Promise<CandidateJobPreferences | null> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return null;

  const [{ data: base }, { data: cats }, { data: locs }] = await Promise.all([
    supabase
      .from("candidates")
      .select("preferred_work_model, preferred_employment_type, desired_salary_min, desired_salary_max, desired_salary_period")
      .eq("id", candidateId)
      .maybeSingle(),
    supabase.from("candidate_preferred_categories").select("category_id").eq("candidate_id", candidateId),
    supabase.from("candidate_preferred_locations").select("location_id").eq("candidate_id", candidateId),
  ]);

  return {
    categoryIds: (cats ?? []).map((c) => c.category_id),
    locationIds: (locs ?? []).map((l) => l.location_id),
    workModel: (base?.preferred_work_model as WorkModelPreference | null) ?? null,
    employmentType: (base?.preferred_employment_type as EmploymentTypePreference | null) ?? null,
    salaryMin: base?.desired_salary_min ?? null,
    salaryMax: base?.desired_salary_max ?? null,
    salaryPeriod: (base?.desired_salary_period as SalaryPeriodPreference | null) ?? null,
  };
}

export async function saveCandidateJobPreferences(input: CandidateJobPreferences): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  await supabase
    .from("candidates")
    .update({
      preferred_work_model: input.workModel,
      preferred_employment_type: input.employmentType,
      desired_salary_min: input.salaryMin,
      desired_salary_max: input.salaryMax,
      desired_salary_period: input.salaryPeriod,
    })
    .eq("id", candidateId);

  await supabase.from("candidate_preferred_categories").delete().eq("candidate_id", candidateId);
  if (input.categoryIds.length > 0) {
    await supabase.from("candidate_preferred_categories").insert(
      input.categoryIds.map((categoryId) => ({ candidate_id: candidateId, category_id: categoryId })),
    );
  }

  await supabase.from("candidate_preferred_locations").delete().eq("candidate_id", candidateId);
  if (input.locationIds.length > 0) {
    await supabase.from("candidate_preferred_locations").insert(
      input.locationIds.map((locationId) => ({ candidate_id: candidateId, location_id: locationId })),
    );
  }
}
