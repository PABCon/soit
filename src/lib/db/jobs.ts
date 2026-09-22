import { createClient } from "@/lib/supabase/server";
import { geocodeLocation } from "@/lib/geocode";
import { slugify } from "@/lib/slug";
import type { Job } from "@/lib/types";
import { getMyEmployerContext } from "./companies";

const SELECT = `
  id, slug, title, description, language, seniority, work_model, location,
  latitude, longitude, salary_min, salary_max, salary_currency, salary_period,
  salary_months, employment_type, status, published_at, expires_at, created_at,
  companies!inner ( slug, company_name, company_logo_url ),
  job_tech_tags ( tech_tags ( slug, label ) )
`;

type JobRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  language: "pt" | "en";
  seniority: Job["seniority"];
  work_model: Job["workModel"];
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  salary_period: Job["salaryPeriod"];
  salary_months: number | null;
  employment_type: Job["employmentType"];
  status: "draft" | "published" | "inactive" | "closed";
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  companies: { slug: string; company_name: string; company_logo_url: string | null };
  job_tech_tags: { tech_tags: { slug: string; label: string } }[];
};

function toJob(row: JobRow): Job {
  const posted = row.published_at ?? row.created_at;
  return {
    slug: row.slug,
    title: row.title,
    company: {
      slug: row.companies.slug,
      name: row.companies.company_name,
      logoUrl: row.companies.company_logo_url,
    },
    location: row.location,
    lat: row.latitude,
    lng: row.longitude,
    workModel: row.work_model,
    seniority: row.seniority,
    tech: row.job_tech_tags.map((t) => t.tech_tags.label),
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryPeriod: row.salary_period,
    salaryMonths: row.salary_months ?? undefined,
    employmentType: row.employment_type,
    language: row.language,
    postedDaysAgo: Math.max(0, Math.floor((Date.now() - new Date(posted).getTime()) / 86_400_000)),
  };
}

export type JobDetail = Job & { id: string; description: string; publishedAt: string; expiresAt: string };

function toJobDetail(row: JobRow): JobDetail {
  return {
    ...toJob(row),
    id: row.id,
    description: row.description,
    publishedAt: row.published_at ?? row.created_at,
    expiresAt: row.expires_at ?? row.created_at,
  };
}

/** The live condition (§5.5): published and not expired. Queried directly
 *  against `jobs` (not the `live_jobs` view) so PostgREST's FK-based
 *  embedding of companies/tech_tags works — views don't reliably expose it. */
export async function getLiveJobs(): Promise<Job[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(SELECT)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as JobRow[]).map(toJob);
}

export async function getLiveJobBySlug(slug: string): Promise<JobDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return toJobDetail(data as unknown as JobRow);
}

export type ConsoleTab = "active" | "inactive" | "drafts";

export type ConsoleJob = Job & {
  id: string;
  status: JobRow["status"];
  applicantCount: number;
};

export async function getCompanyJobs(companyId: string, tab: ConsoleTab): Promise<ConsoleJob[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("jobs")
    .select(`${SELECT}, applications(count)`)
    .eq("company_id", companyId);

  if (tab === "active") {
    query = query.eq("status", "published").gt("expires_at", nowIso);
  } else if (tab === "drafts") {
    query = query.eq("status", "draft");
  } else {
    query = query.or(
      `and(status.eq.published,expires_at.lte.${nowIso}),status.eq.inactive,status.eq.closed`,
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];

  return (data as unknown as (JobRow & { applications: { count: number }[] })[]).map((row) => ({
    ...toJob(row),
    id: row.id,
    status: row.status,
    applicantCount: row.applications?.[0]?.count ?? 0,
  }));
}

export type JobFormInput = {
  title: string;
  description: string;
  language: "pt" | "en";
  seniority: Job["seniority"];
  workModel: Job["workModel"];
  location: string;
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: Job["salaryPeriod"];
  salaryMonths: number | null;
  employmentType: Job["employmentType"];
  techTagIds: string[];
  publish: boolean;
};

export type SaveResult = { slug: string; published: boolean; message?: string };

/** Creates or updates a job (existing `jobId` = edit). Publish is gated
 *  server-side on live `verification_status` (§5.7.4) — RLS only checks
 *  company ownership, so an unverified employer's own client could
 *  otherwise write status='published' directly; the gate has to live here. */
export async function saveJob(jobId: string | null, input: JobFormInput): Promise<SaveResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) throw new Error("Not an employer");

  const supabase = await createClient();
  const isRemote = input.workModel === "remote";
  const coords = !isRemote && input.location.trim() ? await geocodeLocation(input.location) : null;

  const wantsPublish = input.publish;
  const canPublish = ctx.company.verification_status === "verified";
  const willPublish = wantsPublish && canPublish;

  const now = new Date();
  const base = {
    company_id: ctx.company.id,
    title: input.title,
    description: input.description,
    language: input.language,
    seniority: input.seniority,
    work_model: input.workModel,
    location: isRemote ? null : input.location.trim() || null,
    latitude: isRemote ? null : (coords?.lat ?? null),
    longitude: isRemote ? null : (coords?.lng ?? null),
    salary_min: input.salaryMin,
    salary_max: input.salaryMax,
    salary_period: input.salaryPeriod,
    salary_months: input.salaryPeriod === "month" ? input.salaryMonths : null,
    employment_type: input.employmentType,
    status: willPublish ? "published" : "draft",
    ...(willPublish
      ? { published_at: now.toISOString(), expires_at: new Date(now.getTime() + 30 * 864e5).toISOString() }
      : {}),
  };

  let id = jobId;
  if (id) {
    const { error } = await supabase.from("jobs").update(base).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("jobs")
      .insert({ ...base, slug: slugify(input.title), created_by: ctx.employerId })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
  }

  await supabase.from("job_tech_tags").delete().eq("job_id", id);
  if (input.techTagIds.length > 0) {
    await supabase
      .from("job_tech_tags")
      .insert(input.techTagIds.map((tech_tag_id) => ({ job_id: id, tech_tag_id })));
  }

  const { data: saved } = await supabase.from("jobs").select("slug").eq("id", id).single();

  return {
    slug: saved!.slug,
    published: willPublish,
    message: wantsPublish && !canPublish ? "notVerified" : undefined,
  };
}

export async function getJobForEdit(jobId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, company_id, title, description, language, seniority, work_model, location, salary_min, salary_max, salary_period, salary_months, employment_type, status, job_tech_tags(tech_tag_id)",
    )
    .eq("id", jobId)
    .maybeSingle();
  return data;
}
