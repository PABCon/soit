import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { sniffFileType } from "@/lib/file-sniff";
import type { Job } from "@/lib/types";

const MAX_CV_BYTES = 5 * 1024 * 1024; // 5MB, §6.7
const DAILY_APPLICATION_CAP = 20; // §6.7 — per-candidate cap, replaces the dropped per-IP/email limits

export type ApplyResult =
  | { ok: true }
  | { ok: false; reason: "not_candidate" | "job_not_found" | "already_applied" | "rate_limited" | "bad_file" | "file_too_large" | "upload_failed" | "db_error" };

/** Server-side, for the job detail page to decide what the Apply button
 *  should do — show the form, or route to candidate login/register. */
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
 * Apply requires an authenticated candidate (§6.7, revised v1.10) — the
 * caller must already hold a verified `candidates` row. The "job must be
 * live" check is enforced twice on purpose: here for a fast, specific
 * error message, and again by the `candidates apply to live jobs` RLS
 * policy, which is the actual authorization boundary.
 */
export async function applyToJob(jobSlug: string, file: File, coverNote: string): Promise<ApplyResult> {
  const supabase = await createClient();

  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_candidate" };

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
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

  if (file.size === 0 || file.size > MAX_CV_BYTES) return { ok: false, reason: "file_too_large" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffFileType(bytes);
  if (!kind) return { ok: false, reason: "bad_file" };

  const admin = createAdminClient();
  const path = `${candidateId}/${job.id}-${Date.now()}.${kind}`;
  const contentType = kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const { error: uploadError } = await admin.storage.from("cvs").upload(path, bytes, { contentType });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { error: insertError } = await supabase.from("applications").insert({
    job_id: job.id,
    candidate_id: candidateId,
    cv_url: path,
    cover_note: coverNote.trim() || null,
  });
  if (insertError) {
    // unique(job_id, candidate_id) — the double-submit backstop.
    if (insertError.code === "23505") return { ok: false, reason: "already_applied" };
    return { ok: false, reason: "db_error" };
  }

  await logEvent("application.created", { job_id: job.id, candidate_id: candidateId });
  return { ok: true };
}

export type MyApplication = {
  id: string;
  status: "applied" | "viewed" | "responded" | "rejected" | "closed";
  createdAt: string;
  job: Pick<Job, "slug" | "title"> & { company: Job["company"] };
};

export async function getMyApplications(): Promise<MyApplication[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(
      "id, status, created_at, jobs!inner ( slug, title, companies!inner ( slug, company_name, company_logo_url ) )",
    )
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
  cvSignedUrl: string | null;
};

/** Employer's applicant list for one of their own jobs. The `applications`
 *  list itself is RLS-scoped (existing "employers see applications to
 *  their company's jobs" policy) — but `candidates` deliberately has no
 *  policy letting an employer read it directly ("Employers never read this
 *  table," step 2's schema comment), so an embedded join 403s. The admin
 *  client fills in the candidate's name/email here, same pattern as Team's
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
        admin.from("candidates").select("full_name, email").eq("id", row.candidate_id).single(),
        admin.storage.from("cvs").createSignedUrl(row.cv_url, 900),
      ]);
      return {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        coverNote: row.cover_note,
        candidateName: candidate?.full_name ?? "—",
        candidateEmail: candidate?.email ?? "—",
        cvSignedUrl: signed?.signedUrl ?? null,
      };
    }),
  );
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
