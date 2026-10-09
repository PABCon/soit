import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { sniffFileType } from "@/lib/file-sniff";
import { extractCvText } from "@/lib/cv-text";
import { generateApplicantSynopsis, type ApplicantSynopsis } from "@/lib/ai/applicant-synopsis";
import { sendEmail } from "@/lib/email/send";
import { applicationConfirmationEmail } from "@/lib/email/templates/application-confirmation";
import { newApplicantEmail } from "@/lib/email/templates/new-applicant";
import type { Job } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_CV_BYTES = 5 * 1024 * 1024; // 5MB, §6.7
const DAILY_APPLICATION_CAP = 20; // §6.7 — per-candidate/per-email cap, no new infra
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type UploadCvResult = { error: "file_too_large" | "bad_file" | "upload_failed" } | { path: string };

async function uploadCv(admin: SupabaseClient, candidateId: string, jobId: string, file: File): Promise<UploadCvResult> {
  if (file.size === 0 || file.size > MAX_CV_BYTES) return { error: "file_too_large" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffFileType(bytes);
  if (!kind) return { error: "bad_file" };

  const path = `${candidateId}/${jobId}-${Date.now()}.${kind}`;
  const contentType =
    kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const { error: uploadError } = await admin.storage.from("cvs").upload(path, bytes, { contentType });
  if (uploadError) return { error: "upload_failed" };

  return { path };
}

/** §9.1a — fires both application-flow emails. Never lets a failure here
 *  break the caller; sendEmail already swallows its own errors. */
async function notifyApplicationCreated(params: {
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  candidateName: string;
  candidateEmail: string;
  /** False only for the account-free apply path (§6.7) — drives the
   *  confirmation email to mention creating an account, since otherwise
   *  there's nowhere for this person to go back and track the
   *  application or read a reply. complete-registration.ts already
   *  claims any guest `candidates` row by matching email on signup, so
   *  registering with the same address reattaches this exact
   *  application automatically — no separate merge step needed. */
  candidateHasAccount: boolean;
}) {
  const { jobId, jobTitle, companyId, companyName, candidateName, candidateEmail, candidateHasAccount } = params;
  const admin = createAdminClient();

  await sendEmail(
    applicationConfirmationEmail({
      to: candidateEmail,
      candidateName,
      jobTitle,
      companyName,
      registerUrl: candidateHasAccount
        ? null
        : `${SITE}/pt/candidate/register?email=${encodeURIComponent(candidateEmail)}`,
    }),
  );

  const { data: members } = await admin.from("employer_users").select("auth_user_id").eq("company_id", companyId);
  const applicantsUrl = `${SITE}/pt/recruit/jobs/${jobId}/applicants`;
  await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.auth_user_id);
      if (!data.user?.email) return;
      await sendEmail(
        newApplicantEmail({ to: data.user.email, candidateName, jobTitle, applicantsUrl }),
      );
    }),
  );
}

/** Never blocks the response the applicant is waiting on — same pattern as
 *  complete-registration.ts's VIES kick-off: try after() first, fall back
 *  to fire-and-forget if there's no request scope to schedule it in. */
function scheduleApplicationCreatedNotification(params: Parameters<typeof notifyApplicationCreated>[0]) {
  try {
    after(() => notifyApplicationCreated(params));
  } catch {
    void notifyApplicationCreated(params);
  }
}

export type ApplyResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_candidate"
        | "job_not_found"
        | "already_applied"
        | "rate_limited"
        | "bad_file"
        | "file_too_large"
        | "upload_failed"
        | "db_error";
    };

/** Server-side, for the job detail page to decide what the Apply button
 *  should do — show the modal pre-filled, or the full anonymous form. */
export async function getApplyStatus(jobId: string): Promise<{ isCandidate: boolean; alreadyApplied: boolean }> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { isCandidate: false, alreadyApplied: false };

  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("candidate_id", candidateId)
    .maybeSingle();

  return { isCandidate: true, alreadyApplied: !!existing };
}

/**
 * A candidate who's already logged in applies directly against their
 * existing, verified row (§6.7 — the simpler of the two paths; no
 * unclaimed-profile step, RLS is the real authorization boundary via the
 * "candidates apply to live jobs" policy).
 */
export async function applyToJob(jobSlug: string, file: File, coverNote: string): Promise<ApplyResult> {
  const supabase = await createClient();

  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_candidate" };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, company_id, companies!inner ( company_name )")
    .eq("slug", jobSlug)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!job) return { ok: false, reason: "job_not_found" };

  const { count: recentCount } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", candidateId)
    .gt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((recentCount ?? 0) >= DAILY_APPLICATION_CAP) return { ok: false, reason: "rate_limited" };

  const admin = createAdminClient();
  const uploaded = await uploadCv(admin, candidateId, job.id, file);
  if ("error" in uploaded) return { ok: false, reason: uploaded.error };

  const { error: insertError } = await supabase.from("applications").insert({
    job_id: job.id,
    candidate_id: candidateId,
    cv_url: uploaded.path,
    cover_note: coverNote.trim() || null,
  });
  if (insertError) {
    // unique(job_id, candidate_id) — the double-submit backstop.
    if (insertError.code === "23505") return { ok: false, reason: "already_applied" };
    return { ok: false, reason: "db_error" };
  }

  await logEvent("application.created", { job_id: job.id, candidate_id: candidateId });

  const { data: candidate } = await supabase.from("candidates").select("full_name, email").eq("id", candidateId).single();
  const companies = job.companies as unknown as { company_name: string };
  scheduleApplicationCreatedNotification({
    jobId: job.id,
    jobTitle: job.title,
    companyId: job.company_id,
    companyName: companies.company_name,
    candidateName: candidate?.full_name ?? "",
    candidateEmail: candidate?.email ?? "",
    candidateHasAccount: true,
  });

  return { ok: true };
}

export type AnonymousApplyResult =
  | { ok: true; companyName: string }
  | {
      ok: false;
      reason:
        | "job_not_found"
        | "already_applied"
        | "email_has_account"
        | "rate_limited"
        | "bad_file"
        | "file_too_large"
        | "upload_failed"
        | "db_error";
    };

/**
 * Account-free apply (§6.7, v1.11): creates or matches an unclaimed
 * candidates row (§6.5) rather than requiring a session first. Everything
 * here runs through the admin client — there's no RLS identity for an
 * anonymous caller to lean on, same shape as complete-registration.ts's
 * privileged writes.
 */
export async function applyAnonymously(
  jobSlug: string,
  input: { fullName: string; email: string; file: File; coverNote: string },
): Promise<AnonymousApplyResult> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  const { data: job } = await admin
    .from("jobs")
    .select("id, title, company_id, companies!inner ( company_name )")
    .eq("slug", jobSlug)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!job) return { ok: false, reason: "job_not_found" };
  const companies = job.companies as unknown as { company_name: string };

  const { count: recentCount } = await admin
    .from("applications")
    .select("id, candidates!inner(email)", { count: "exact", head: true })
    .eq("candidates.email", email)
    .gt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((recentCount ?? 0) >= DAILY_APPLICATION_CAP) return { ok: false, reason: "rate_limited" };

  // §6.5 rule 6 (v1.11): a claimed account never gets silently attached to.
  const { data: existing } = await admin
    .from("candidates")
    .select("id, auth_user_id")
    .eq("email", email)
    .maybeSingle();
  if (existing?.auth_user_id) return { ok: false, reason: "email_has_account" };

  let candidateId = existing?.id;
  if (!candidateId) {
    const { data: created, error: createError } = await admin
      .from("candidates")
      .insert({ email, full_name: input.fullName.trim(), email_verified: false, auth_provider: "email" })
      .select("id")
      .single();
    if (createError) return { ok: false, reason: "db_error" };
    candidateId = created.id;
  }

  const uploaded = await uploadCv(admin, candidateId, job.id, input.file);
  if ("error" in uploaded) return { ok: false, reason: uploaded.error };

  const { error: insertError } = await admin.from("applications").insert({
    job_id: job.id,
    candidate_id: candidateId,
    cv_url: uploaded.path,
    cover_note: input.coverNote.trim() || null,
  });
  if (insertError) {
    if (insertError.code === "23505") return { ok: false, reason: "already_applied" };
    return { ok: false, reason: "db_error" };
  }

  await logEvent("application.created", { job_id: job.id, candidate_id: candidateId });

  scheduleApplicationCreatedNotification({
    jobId: job.id,
    jobTitle: job.title,
    companyId: job.company_id,
    companyName: companies.company_name,
    candidateName: input.fullName.trim(),
    candidateEmail: email,
    candidateHasAccount: false,
  });

  return { ok: true, companyName: companies.company_name };
}

export type MyApplication = {
  id: string;
  status: "applied" | "viewed" | "responded" | "rejected" | "closed";
  createdAt: string;
  job: Pick<Job, "slug" | "title"> & { company: Job["company"] };
};

export async function getMyApplications(): Promise<MyApplication[]> {
  const supabase = await createClient();

  // Deliberately explicit, not left to RLS alone: `applications` also has an
  // "employers see applications to their company's jobs" SELECT policy
  // (needed for getApplicantsForJob) — Postgres combines permissive
  // policies with OR, so an unfiltered select() from an employer session
  // returned every applicant to their own jobs here too, mislabeled as
  // "my applications." Real bug, found via a real-usage report.
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return [];

  const { data } = await supabase
    .from("applications")
    .select(
      "id, status, created_at, jobs!inner ( slug, title, companies!inner ( slug, company_name, company_logo_url ) )",
    )
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return data.map((row) => {
    const job = row.jobs as unknown as {
      slug: string;
      title: string;
      companies: { slug: string; company_name: string; company_logo_url: string | null };
    };
    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      job: {
        slug: job.slug,
        title: job.title,
        company: { slug: job.companies.slug, name: job.companies.company_name, logoUrl: job.companies.company_logo_url },
      },
    };
  });
}

export type Applicant = {
  id: string;
  status: MyApplication["status"];
  createdAt: string;
  coverNote: string | null;
  candidateName: string;
  candidateEmail: string;
  /** Real-usage report (§7.2 review): a dedicated candidate detail page
   *  needs more than name/email — these mirror the fields the candidate's
   *  own profile form already exposes. */
  phone: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  skills: string[];
  cvSignedUrl: string | null;
};

const CANDIDATE_DETAIL_SELECT = "full_name, email, phone, linkedin_url, avatar_url, skills";

function toApplicant(
  row: { id: string; status: MyApplication["status"]; created_at: string; cover_note: string | null },
  candidate: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    avatar_url: string | null;
    skills: string[] | null;
  } | null,
  cvSignedUrl: string | null,
): Applicant {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    coverNote: row.cover_note,
    candidateName: candidate?.full_name ?? "—",
    candidateEmail: candidate?.email ?? "—",
    phone: candidate?.phone ?? null,
    linkedinUrl: candidate?.linkedin_url ?? null,
    avatarUrl: candidate?.avatar_url ?? null,
    skills: candidate?.skills ?? [],
    cvSignedUrl,
  };
}

/** Employer's applicant list for one of their own jobs. The `applications`
 *  list itself is RLS-scoped (existing "employers see applications to
 *  their company's jobs" policy) — but `candidates` deliberately has no
 *  policy letting an employer read it directly ("Employers never read this
 *  table," step 2's schema comment), so an embedded join 403s. The admin
 *  client fills in the candidate's details here, same pattern as Team's
 *  email lookup, plus mints the short-lived signed CV URL (§6.3) — the cvs
 *  bucket has no read policy for anyone. */
export async function getApplicantsForJob(jobId: string): Promise<Applicant[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("id, status, created_at, cover_note, cv_url, candidate_id")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (!data) return [];

  const admin = createAdminClient();
  return Promise.all(
    data.map(async (row) => {
      const [{ data: candidate }, { data: signed }] = await Promise.all([
        admin.from("candidates").select(CANDIDATE_DETAIL_SELECT).eq("id", row.candidate_id).single(),
        admin.storage.from("cvs").createSignedUrl(row.cv_url, 900),
      ]);
      return toApplicant(row, candidate, signed?.signedUrl ?? null);
    }),
  );
}

export type CompanyApplicant = Applicant & { jobId: string; jobTitle: string; jobSlug: string };

/** Item 2 (§7.2 review): applicants were only ever reachable per-job.
 *  Same RLS-scoped `applications` read + admin-client candidate lookup as
 *  `getApplicantsForJob`, just filtered by the embedded job's `company_id`
 *  instead of a single `job_id` — the same "force !inner + dot-notation
 *  filter" trick `getBrowseJobs()` already uses to restrict parent rows by
 *  an embedded resource's column. */
export async function getAllApplicantsForCompany(companyId: string): Promise<CompanyApplicant[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("id, status, created_at, cover_note, cv_url, candidate_id, jobs!inner ( id, title, slug, company_id )")
    .eq("jobs.company_id", companyId)
    .order("created_at", { ascending: false });

  if (!data) return [];

  const admin = createAdminClient();
  return Promise.all(
    data.map(async (row) => {
      const job = row.jobs as unknown as { id: string; title: string; slug: string };
      const [{ data: candidate }, { data: signed }] = await Promise.all([
        admin.from("candidates").select(CANDIDATE_DETAIL_SELECT).eq("id", row.candidate_id).single(),
        admin.storage.from("cvs").createSignedUrl(row.cv_url, 900),
      ]);
      return { ...toApplicant(row, candidate, signed?.signedUrl ?? null), jobId: job.id, jobTitle: job.title, jobSlug: job.slug };
    }),
  );
}

export type ApplicantDetail = Applicant & {
  jobId: string;
  jobTitle: string;
  jobSlug: string;
  companyName: string;
  aiSynopsis: ApplicantSynopsis | null;
};

/** The canonical candidate-detail route (`/recruit/applicants/[id]`),
 *  reachable from both the per-job and the aggregated applicant lists —
 *  one page, not two. Relies entirely on the same `applications` RLS
 *  policy every other applicant read here does: a row for a job this
 *  employer's company doesn't own simply doesn't come back, no separate
 *  ownership check needed. */
export async function getApplicantDetail(applicationId: string): Promise<ApplicantDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(
      "id, status, created_at, cover_note, cv_url, candidate_id, ai_synopsis, jobs!inner ( id, title, slug, companies!inner ( company_name ) )",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!data) return null;

  const job = data.jobs as unknown as {
    id: string;
    title: string;
    slug: string;
    companies: { company_name: string };
  };

  const admin = createAdminClient();
  const [{ data: candidate }, { data: signed }] = await Promise.all([
    admin.from("candidates").select(CANDIDATE_DETAIL_SELECT).eq("id", data.candidate_id).single(),
    admin.storage.from("cvs").createSignedUrl(data.cv_url, 900),
  ]);

  return {
    ...toApplicant(data, candidate, signed?.signedUrl ?? null),
    jobId: job.id,
    jobTitle: job.title,
    jobSlug: job.slug,
    companyName: job.companies.company_name,
    aiSynopsis: (data.ai_synopsis as ApplicantSynopsis | null) ?? null,
  };
}

export type GenerateSynopsisResult =
  | { ok: true; data: ApplicantSynopsis }
  | { ok: false; reason: "not_found" | "empty_content" | "generation_failed" };

/** Explicit, employer-triggered — see applicant-synopsis.ts's own doc
 *  comment for why this isn't automatic. Relies on the same RLS-scoped
 *  `applications` read `getApplicantDetail` already does for
 *  authorization (a row for a job this employer's company doesn't own
 *  simply doesn't come back) before ever touching the admin client. */
export async function generateApplicantSynopsisForApplication(applicationId: string): Promise<GenerateSynopsisResult> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("id, cover_note, cv_url, jobs!inner ( title, description )")
    .eq("id", applicationId)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };

  const job = data.jobs as unknown as { title: string; description: string };
  const admin = createAdminClient();

  let cvText: string | null = null;
  const { data: cvBlob } = await admin.storage.from("cvs").download(data.cv_url);
  if (cvBlob) {
    const bytes = new Uint8Array(await cvBlob.arrayBuffer());
    const kind = sniffFileType(bytes);
    if (kind) cvText = await extractCvText(bytes, kind);
  }

  const result = await generateApplicantSynopsis({
    jobTitle: job.title,
    jobDescription: job.description,
    cvText,
    coverNote: data.cover_note,
  });
  if (!result.ok) return result;

  await admin.from("applications").update({ ai_synopsis: result.data }).eq("id", applicationId);
  return result;
}

export async function updateApplicationStatus(applicationId: string, status: MyApplication["status"]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .select("job_id, candidate_id")
    .single();
  if (error) throw new Error(error.message);

  await logEvent("application.status_changed", { application_id: applicationId, status, job_id: data.job_id });
}
