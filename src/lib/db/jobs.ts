import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import type { Job, SkillLevel } from "@/lib/types";
import { getMyEmployerContext, type MyCompany } from "./companies";
import { getMyEmployerUnreadThreadCount } from "./messaging";

/** An API-key-authenticated request has no cookie session at all — only
 *  the caller's already-verified `companyId` (from
 *  `authenticateApiRequest`). `saveJob`/`setJobStatus`/`deleteJob` each
 *  accept this as an optional override; with no override they behave
 *  exactly as before (the one console call site never passes one). */
export type JobWriteOverride = { companyId: string };

type JobWriteContext = {
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
  employerId: string | null;
  company: MyCompany;
};

async function resolveJobWriteContext(override?: JobWriteOverride): Promise<JobWriteContext | null> {
  if (override) {
    const admin = createAdminClient();
    const { data: company } = await admin.from("companies").select("*").eq("id", override.companyId).maybeSingle();
    if (!company) return null;
    return { supabase: admin, employerId: null, company: company as MyCompany };
  }
  const ctx = await getMyEmployerContext();
  if (!ctx) return null;
  return { supabase: await createClient(), employerId: ctx.employerId, company: ctx.company };
}

export const SELECT = `
  id, slug, title, description, language, seniority, work_model, location,
  latitude, longitude, salary_min, salary_max, salary_currency, salary_period,
  salary_months, employment_type, status, published_at, expires_at, created_at,
  external_apply_url, location_id, salary_public, boost_rank_at, boosted_until,
  companies!inner ( slug, company_name, company_logo_url, company_description, top_employer_active ),
  job_tech_tags ( level, required, tech_tags ( slug, label ) ),
  job_categories ( slug ),
  locations ( slug ),
  job_languages ( level, spoken_languages ( slug, label ) )
`;

export type JobRow = {
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
  external_apply_url: string | null;
  location_id: string | null;
  salary_public: boolean;
  boost_rank_at: string | null;
  boosted_until: string | null;
  companies: {
    slug: string;
    company_name: string;
    company_logo_url: string | null;
    company_description: string | null;
    top_employer_active: boolean;
  };
  job_tech_tags: { level: SkillLevel | null; required: boolean; tech_tags: { slug: string; label: string } }[];
  job_categories: { slug: string } | null;
  locations: { slug: string } | null;
  job_languages: { level: SkillLevel | null; spoken_languages: { slug: string; label: string } }[];
};

/** Always includes the real salary — callers on the public path (getLiveJobs
 *  etc.) null it out afterward when `salary_public` is false. Console reads
 *  (the employer's own jobs) skip that step entirely: an employer always
 *  sees their own real numbers regardless of what candidates are shown. */
export function toJob(row: JobRow): Job {
  const posted = row.published_at ?? row.created_at;
  const daysLeft = row.expires_at
    ? Math.max(0, Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 86_400_000))
    : null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    company: {
      slug: row.companies.slug,
      name: row.companies.company_name,
      logoUrl: row.companies.company_logo_url,
    },
    location: row.location,
    locationSlug: row.locations?.slug ?? null,
    lat: row.latitude,
    lng: row.longitude,
    workModel: row.work_model,
    seniority: row.seniority,
    tech: row.job_tech_tags.map((t) => t.tech_tags.label),
    categorySlug: row.job_categories?.slug ?? null,
    requiredLanguageSlugs: row.job_languages.map((jl) => jl.spoken_languages.slug),
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryPeriod: row.salary_period,
    salaryMonths: row.salary_months ?? undefined,
    employmentType: row.employment_type,
    language: row.language,
    postedDaysAgo: Math.max(0, Math.floor((Date.now() - new Date(posted).getTime()) / 86_400_000)),
    daysLeft,
    isTopEmployer: row.companies.top_employer_active,
    isBoosted: !!row.boosted_until && new Date(row.boosted_until).getTime() > Date.now(),
  };
}

/** Hides the salary on the public path when the employer has chosen to —
 *  a distinct step from toJob() itself, so the exact same mapper can serve
 *  both the public feed (hidden) and the console's own job list (always
 *  real), without duplicating every other field. Exported for
 *  recommendations.ts, the one other candidate-facing consumer of raw
 *  JobRow-shaped data outside this file. */
export function hideSalaryIfPrivate(row: JobRow, job: Job): Job {
  if (row.salary_public) return job;
  return { ...job, salaryMin: null, salaryMax: null };
}

/** Top-Employer jobs sort first (their own subscription perk), then by
 *  `boost_rank_at` — a manual bump or the salary-transparency auto-boost
 *  jumps a job back to the top of its own bracket, same idea as a repost,
 *  not a fixed multi-day pinned state. Stable sort: within each bracket,
 *  rows already arrive `boost_rank_at desc` from the DB `order()` clause,
 *  so this only ever reorders across the Top-Employer/regular boundary. */
function sortForFeed(rows: JobRow[]): JobRow[] {
  return [...rows].sort((a, b) => {
    const topEmployerDelta = Number(b.companies.top_employer_active) - Number(a.companies.top_employer_active);
    if (topEmployerDelta !== 0) return topEmployerDelta;
    const aRank = a.boost_rank_at ? new Date(a.boost_rank_at).getTime() : 0;
    const bRank = b.boost_rank_at ? new Date(b.boost_rank_at).getTime() : 0;
    return bRank - aRank;
  });
}

export type RequiredLanguage = { slug: string; label: string; level: SkillLevel | null };

export type JobTechStackEntry = { slug: string; label: string; level: SkillLevel | null; required: boolean };

export type JobDetail = Job & {
  id: string;
  description: string;
  publishedAt: string;
  expiresAt: string;
  externalApplyUrl: string | null;
  requiredLanguages: RequiredLanguage[];
  /** Short employer blurb for the sidebar — `companies.company_description`,
   *  null when the employer never filled it in. */
  companyBlurb: string | null;
  /** The same tags as `tech` (plain labels, for the feed/filters), plus the
   *  level/required the employer set for each — real-usage QA item asking
   *  for "tech-stack proficiency shown as grade/icon" on the job page. The
   *  data was already collected and saved by JobForm/saveJob; it just
   *  never made it into anything public-facing before this. */
  techStack: JobTechStackEntry[];
};

function toJobDetail(row: JobRow): JobDetail {
  return {
    ...hideSalaryIfPrivate(row, toJob(row)),
    id: row.id,
    description: row.description,
    publishedAt: row.published_at ?? row.created_at,
    expiresAt: row.expires_at ?? row.created_at,
    externalApplyUrl: row.external_apply_url,
    requiredLanguages: row.job_languages.map((jl) => ({
      slug: jl.spoken_languages.slug,
      label: jl.spoken_languages.label,
      level: jl.level,
    })),
    companyBlurb: row.companies.company_description,
    techStack: row.job_tech_tags.map((t) => ({
      slug: t.tech_tags.slug,
      label: t.tech_tags.label,
      level: t.level,
      required: t.required,
    })),
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
    .order("boost_rank_at", { ascending: false });

  if (error || !data) return [];
  return sortForFeed(data as unknown as JobRow[]).map((row) => hideSalaryIfPrivate(row, toJob(row)));
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

/** Job detail page's "similar roles" rail (real-usage QA item) — same
 *  category first (what a candidate actually means by "similar"); when the
 *  job has no category at all, falls back to other live roles at the same
 *  company rather than showing nothing. Either way, excludes the job
 *  itself and only ever looks at live, unexpired postings. */
export async function getSimilarJobs(job: JobDetail, limit = 4): Promise<Job[]> {
  const supabase = await createClient();

  let categoryId: string | undefined;
  if (job.categorySlug) {
    const { data: category } = await supabase
      .from("job_categories")
      .select("id")
      .eq("slug", job.categorySlug)
      .maybeSingle();
    categoryId = category?.id;
  }

  let query = supabase
    .from("jobs")
    .select(SELECT)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString())
    .neq("id", job.id)
    .order("boost_rank_at", { ascending: false })
    .limit(limit);

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  } else {
    const { data: company } = await supabase.from("companies").select("id").eq("slug", job.company.slug).maybeSingle();
    if (!company) return [];
    query = query.eq("company_id", company.id);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as JobRow[]).map((row) => hideSalaryIfPrivate(row, toJob(row)));
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

export type EmployerDashboardStats = {
  activeJobs: number;
  totalApplicants: number;
  newApplicantsLast7Days: number;
  unreadMessages: number;
};

/** Console dashboard home (real-usage QA item) — `/recruit` was only
 *  ever the job list, with nothing summarizing how things are actually
 *  going. Four counts, each a plain `count: "exact", head: true`
 *  aggregate query (no rows fetched) rather than reusing
 *  `getCompanyJobs()`'s own per-job `applications(count)` and summing
 *  client-side — this only needs the totals, not every job's full
 *  `Job` shape. */
export async function getEmployerDashboardStats(companyId: string): Promise<EmployerDashboardStats> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ count: activeJobs }, { count: totalApplicants }, { count: newApplicantsLast7Days }, unreadMessages] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "published")
        .gt("expires_at", nowIso),
      supabase
        .from("applications")
        .select("id, jobs!inner(company_id)", { count: "exact", head: true })
        .eq("jobs.company_id", companyId),
      supabase
        .from("applications")
        .select("id, jobs!inner(company_id)", { count: "exact", head: true })
        .eq("jobs.company_id", companyId)
        .gt("created_at", sevenDaysAgoIso),
      getMyEmployerUnreadThreadCount(),
    ]);

  return {
    activeJobs: activeJobs ?? 0,
    totalApplicants: totalApplicants ?? 0,
    newApplicantsLast7Days: newApplicantsLast7Days ?? 0,
    unreadMessages,
  };
}

/** One required tech tag, with an optional proficiency level and whether
 *  it's a hard must-have or just a nice-to-have (§ real-usage QA, item
 *  10b) — replaces the old flat `techTagIds: string[]`. */
export type JobTechTagInput = { techTagId: string; level: SkillLevel | null; required: boolean };
export type JobLanguageInput = { spokenLanguageId: string; level: SkillLevel | null };

export type JobFormInput = {
  title: string;
  description: string;
  language: "pt" | "en";
  seniority: Job["seniority"];
  workModel: Job["workModel"];
  locationId: string | null;
  categoryId: string;
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: Job["salaryPeriod"];
  salaryMonths: number | null;
  employmentType: Job["employmentType"];
  techTags: JobTechTagInput[];
  languages: JobLanguageInput[];
  externalApplyUrl: string;
  /** Employer-chosen deadline (a "yyyy-mm-dd" date string from the form's
   *  date input), or null to fall back to the 30-day default (§10). Only
   *  takes effect when the job is actually being published — a draft
   *  doesn't get an expires_at at all, same as before. */
  expiresAt: string | null;
  publish: boolean;
  /** The employer's requested choice — `saveJob` overrides this to `true`
   *  unless the company is currently a paying customer (§pricing: hiding
   *  the salary is a paid-tier perk, never available on the free slot). */
  salaryPublic: boolean;
};

export type SaveResult = { id: string; slug: string; published: boolean; message?: string };

/** How many of this company's OTHER jobs are currently live (published,
 *  not expired) — "other" so editing an already-published job doesn't
 *  count itself against its own allowance. */
async function countOtherLiveJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  excludeJobId: string | null,
): Promise<number> {
  let query = supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString());
  if (excludeJobId) query = query.neq("id", excludeJobId);
  const { count } = await query;
  return count ?? 0;
}

/** Creates or updates a job (existing `jobId` = edit). Publish is gated
 *  server-side on live `verification_status` (§5.7.4) — RLS only checks
 *  company ownership, so an unverified employer's own client could
 *  otherwise write status='published' directly; the gate has to live here.
 *
 *  §pricing adds a second gate on top: every verified company may always
 *  have 1 job live for free (Top Employer raises that standing allowance
 *  to 10); beyond that, publishing needs a purchased ad credit. Hiding the
 *  salary publicly and getting bump credits/the auto-boost are both perks
 *  of being a paying customer in *either* form (a spent credit or an
 *  active Top Employer subscription) — not tied to which specific slot
 *  this job happens to occupy, so a paying company's "free" first job can
 *  hide its salary too, same as any of its others. */
export async function saveJob(
  jobId: string | null,
  input: JobFormInput,
  override?: JobWriteOverride,
): Promise<SaveResult> {
  const resolved = await resolveJobWriteContext(override);
  if (!resolved) throw new Error("Not an employer");
  const { supabase, employerId, company } = resolved;

  const isRemote = input.workModel === "remote";

  let location: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (!isRemote && input.locationId) {
    const { data: place } = await supabase
      .from("locations")
      .select("name, latitude, longitude")
      .eq("id", input.locationId)
      .maybeSingle();
    if (place) {
      location = place.name;
      latitude = place.latitude;
      longitude = place.longitude;
    }
  }

  const wantsPublish = input.publish;
  const isVerified = company.verification_status === "verified";

  const liveCount = await countOtherLiveJobs(supabase, company.id, jobId);
  const isPayingCustomer = company.ad_credits_available > 0 || company.top_employer_active;
  const effectiveFreeCap = company.top_employer_active ? 10 : 1;
  const canPublishFree = liveCount < effectiveFreeCap;
  const canPublishWithCredit = company.ad_credits_available > 0;
  const canPublish = isVerified && (canPublishFree || canPublishWithCredit);
  let willPublish = wantsPublish && canPublish;
  let consumesCredit = willPublish && !canPublishFree;

  // Spend the credit atomically — and *before* ever writing status=
  // "published" — not a JS-computed "old - 1" written back under a now-
  // stale guard (a real bug found via a real purchase: two
  // near-simultaneous publishes could both read the same starting credit
  // count and both pass that stale guard, so both got marked published
  // while the column only ever reflected a single decrement). If this
  // genuinely races with another request and loses, this save must not
  // publish at all — falling back to a draft, not a free, uncharged
  // publish.
  if (consumesCredit) {
    const admin = createAdminClient();
    const { data: decremented } = await admin.rpc("decrement_ad_credit", { target_company_id: company.id });
    if (!decremented) {
      willPublish = false;
      consumesCredit = false;
    }
  }

  // Only a genuine draft/inactive → published transition spends a credit,
  // resets the 30-day window and the boost/bump state — re-saving an
  // already-published job (editing its description, say) must not look
  // like a fresh publish and silently re-charge or reset its clock.
  let wasAlreadyPublished = false;
  if (jobId) {
    const { data: existing } = await supabase.from("jobs").select("status").eq("id", jobId).maybeSingle();
    wasAlreadyPublished = existing?.status === "published";
  }
  const isNewPublish = willPublish && !wasAlreadyPublished;

  const salaryPublic = isPayingCustomer ? input.salaryPublic : true;

  const now = new Date();
  const defaultExpiry = new Date(now.getTime() + 30 * 864e5);
  // Trust the client's date input, but don't trust it blindly — a bad or
  // past date silently falls back to the same 30-day default rather than
  // producing an invalid or already-expired listing.
  const chosenExpiry = input.expiresAt ? new Date(input.expiresAt) : null;
  const expiresAt = chosenExpiry && chosenExpiry.getTime() > now.getTime() ? chosenExpiry : defaultExpiry;
  const autoBoost = isNewPublish && isPayingCustomer && salaryPublic;

  const base = {
    company_id: company.id,
    title: input.title,
    description: input.description,
    language: input.language,
    seniority: input.seniority,
    work_model: input.workModel,
    location,
    location_id: isRemote ? null : input.locationId,
    latitude,
    longitude,
    category_id: input.categoryId,
    salary_min: input.salaryMin,
    salary_max: input.salaryMax,
    salary_period: input.salaryPeriod,
    salary_months: input.salaryPeriod === "month" ? input.salaryMonths : null,
    employment_type: input.employmentType,
    external_apply_url: input.externalApplyUrl.trim() || null,
    salary_public: salaryPublic,
    status: willPublish ? "published" : "draft",
    ...(isNewPublish
      ? {
          published_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          boost_rank_at: now.toISOString(),
          boosted_until: autoBoost ? new Date(now.getTime() + 72 * 3600e3).toISOString() : null,
          bump_credits_remaining: consumesCredit ? 2 : 0,
        }
      : {}),
  };

  let id = jobId;
  if (id) {
    const { error } = await supabase.from("jobs").update(base).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("jobs")
      .insert({ ...base, slug: slugify(input.title), created_by: employerId })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
  }

  await supabase.from("job_tech_tags").delete().eq("job_id", id);
  if (input.techTags.length > 0) {
    await supabase.from("job_tech_tags").insert(
      input.techTags.map((tag) => ({
        job_id: id,
        tech_tag_id: tag.techTagId,
        level: tag.level,
        required: tag.required,
      })),
    );
  }

  await supabase.from("job_languages").delete().eq("job_id", id);
  if (input.languages.length > 0) {
    await supabase.from("job_languages").insert(
      input.languages.map((lang) => ({
        job_id: id,
        spoken_language_id: lang.spokenLanguageId,
        level: lang.level,
      })),
    );
  }

  const { data: saved } = await supabase.from("jobs").select("slug").eq("id", id).single();

  return {
    id: id!,
    slug: saved!.slug,
    published: willPublish,
    message: wantsPublish && !willPublish ? (isVerified ? "noAdCredits" : "notVerified") : undefined,
  };
}

export type SetStatusResult = { ok: boolean; message?: string };

/** Pause/reactivate (§7.2) — the only two transitions this exposes.
 *  Reactivating a paused job renews its 30-day window, same as a fresh
 *  publish, so it's actually live again rather than instantly re-expiring —
 *  and, like a fresh publish in `saveJob`, is gated on the same free-slot/
 *  credit/Top-Employer allowance, spending a credit and resetting the
 *  boost state exactly the same way. Returns `{ok:false, message:
 *  "noAdCredits"}` rather than throwing for that expected, business-rule
 *  case — Next.js redacts thrown Server Action error messages in
 *  production, so a message the UI needs to read back has to travel as a
 *  normal return value, same convention `saveJob`'s `SaveResult` already
 *  uses for "notVerified". */
export async function setJobStatus(
  jobId: string,
  status: "inactive" | "published",
  override?: JobWriteOverride,
): Promise<SetStatusResult> {
  const resolved = await resolveJobWriteContext(override);
  if (!resolved) throw new Error("Not an employer");
  const { supabase, company } = resolved;

  if (status === "inactive") {
    const { error } = await supabase
      .from("jobs")
      .update({ status: "inactive" })
      .eq("id", jobId)
      .eq("company_id", company.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  const liveCount = await countOtherLiveJobs(supabase, company.id, jobId);
  const isPayingCustomer = company.ad_credits_available > 0 || company.top_employer_active;
  const effectiveFreeCap = company.top_employer_active ? 10 : 1;
  const canPublishFree = liveCount < effectiveFreeCap;
  const canPublishWithCredit = company.ad_credits_available > 0;
  if (!(canPublishFree || canPublishWithCredit)) return { ok: false, message: "noAdCredits" };
  const consumesCredit = !canPublishFree;

  // Same atomic-decrement-before-publish fix as saveJob (see its own
  // comment) — reactivating a paused job spends a credit through this
  // exact same path, so it needs the exact same race-safe guard.
  if (consumesCredit) {
    const admin = createAdminClient();
    const { data: decremented } = await admin.rpc("decrement_ad_credit", { target_company_id: company.id });
    if (!decremented) return { ok: false, message: "noAdCredits" };
  }

  const { data: job } = await supabase.from("jobs").select("salary_public").eq("id", jobId).maybeSingle();
  const salaryPublic = isPayingCustomer ? (job?.salary_public ?? true) : true;
  const now = new Date();
  const autoBoost = isPayingCustomer && salaryPublic;

  const { error } = await supabase
    .from("jobs")
    .update({
      status: "published",
      salary_public: salaryPublic,
      published_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 864e5).toISOString(),
      boost_rank_at: now.toISOString(),
      boosted_until: autoBoost ? new Date(now.getTime() + 72 * 3600e3).toISOString() : null,
      bump_credits_remaining: consumesCredit ? 2 : 0,
    })
    .eq("id", jobId)
    .eq("company_id", company.id);
  if (error) throw new Error(error.message);

  return { ok: true };
}

/** A job with any applications is DB-restricted from deletion (§15.1,
 *  `applications.job_id ... on delete restrict`) — close/pause it instead.
 *  This only ever gets a real chance to run against a draft in the console
 *  UI, but the ownership check + DB constraint hold regardless of tab. */
export async function deleteJob(jobId: string, override?: JobWriteOverride): Promise<void> {
  const resolved = await resolveJobWriteContext(override);
  if (!resolved) throw new Error("Not an employer");
  const { supabase, company } = resolved;

  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("company_id", company.id);
  if (error) throw new Error(error.message);
}

export type JobForEdit = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  language: "pt" | "en";
  seniority: Job["seniority"];
  work_model: Job["workModel"];
  location: string | null;
  location_id: string | null;
  category_id: string;
  salary_min: number;
  salary_max: number;
  salary_period: Job["salaryPeriod"];
  salary_months: number | null;
  employment_type: Job["employmentType"];
  external_apply_url: string | null;
  status: "draft" | "published" | "inactive" | "closed";
  expires_at: string | null;
  salary_public: boolean;
  job_tech_tags: { tech_tag_id: string; level: SkillLevel | null; required: boolean }[];
  job_languages: { spoken_language_id: string; level: SkillLevel | null }[];
};

export async function getJobForEdit(jobId: string): Promise<JobForEdit | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, company_id, title, description, language, seniority, work_model, location, location_id, category_id, salary_min, salary_max, salary_period, salary_months, employment_type, external_apply_url, status, expires_at, salary_public, job_tech_tags(tech_tag_id, level, required), job_languages(spoken_language_id, level)",
    )
    .eq("id", jobId)
    .maybeSingle();
  return data as unknown as JobForEdit | null;
}

export type BrowseResult = {
  jobs: Job[];
  locationName: string | null;
  /** null when no facet was requested. "category" facets should be
   *  displayed via i18n (`jobForm.categoryOption.{facetSlug}`), not this
   *  raw DB label — it's stored in English only. "tech" facets are shown
   *  as-is (tech names like "React"/"AWS" aren't translated anywhere else
   *  in this app either). */
  facetKind: "category" | "tech" | null;
  facetSlug: string | null;
  facetLabel: string | null;
};

/** Powers `/jobs/in/[location]` and `/jobs/in/[location]/[facet]`
 *  (justjoin.it-style browse pages). `facetSlug` is resolved against
 *  `job_categories` first, then `tech_tags` — the two taxonomies share one
 *  URL slot, same as justjoin's own "java" vs "analytics"/"devops" facets.
 *  Returns `null` only when a given slug matches neither taxonomy — the
 *  page 404s on that, same convention as an unknown company/job slug
 *  elsewhere in this app. */
export async function getBrowseJobs(params: {
  locationSlug?: string;
  facetSlug?: string;
}): Promise<BrowseResult | null> {
  const supabase = await createClient();

  let locationId: string | undefined;
  let locationName: string | null = null;
  if (params.locationSlug) {
    const { data: location } = await supabase
      .from("locations")
      .select("id, name")
      .eq("slug", params.locationSlug)
      .maybeSingle();
    if (!location) return null;
    locationId = location.id;
    locationName = location.name;
  }

  let categoryId: string | undefined;
  let techId: string | undefined;
  let facetKind: "category" | "tech" | null = null;
  let facetLabel: string | null = null;
  if (params.facetSlug) {
    const { data: category } = await supabase
      .from("job_categories")
      .select("id, label")
      .eq("slug", params.facetSlug)
      .maybeSingle();
    if (category) {
      categoryId = category.id;
      facetKind = "category";
      facetLabel = category.label;
    } else {
      const { data: tech } = await supabase
        .from("tech_tags")
        .select("id, label")
        .eq("slug", params.facetSlug)
        .maybeSingle();
      if (!tech) return null;
      techId = tech.id;
      facetKind = "tech";
      facetLabel = tech.label;
    }
  }

  // Forcing an inner join on job_tech_tags is how PostgREST lets a filter on
  // an embedded resource actually restrict the parent rows — swapping the
  // embed modifier in place, not appending a second, duplicate embed.
  const selectForQuery = techId ? SELECT.replace("job_tech_tags (", "job_tech_tags!inner (") : SELECT;

  let query = supabase
    .from("jobs")
    .select(selectForQuery)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString());

  if (locationId) query = query.eq("location_id", locationId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (techId) query = query.eq("job_tech_tags.tech_tag_id", techId);

  const { data, error } = await query.order("boost_rank_at", { ascending: false });
  const jobs =
    error || !data
      ? []
      : sortForFeed(data as unknown as JobRow[]).map((row) => hideSalaryIfPrivate(row, toJob(row)));
  return { jobs, locationName, facetKind, facetSlug: params.facetSlug ?? null, facetLabel };
}

// ── API (billing phase 4 — "API access for programmatic job posting") ──────
// The public API deliberately speaks in slugs, never internal UUIDs — an
// external integrator shouldn't need to know this product's ids, only what
// `GET /api/v1/reference` hands them. Both reads below explicitly filter by
// `companyId` in code (never trusting RLS alone) — same convention every
// other write in this file already follows; `getJobForEdit` is NOT reused
// here for exactly that reason, since it trusts RLS instead.

export type ApiJobSummary = {
  id: string;
  slug: string;
  title: string;
  status: JobRow["status"];
  language: "pt" | "en";
  publishedAt: string | null;
  expiresAt: string | null;
  path: string;
};

export async function getAllCompanyJobsForApi(companyId: string): Promise<ApiJobSummary[]> {
  // Admin client, not the cookie-bound one: an API-key request has no
  // Supabase auth session at all, so it hits `jobs`' anon-role RLS policy,
  // which only exposes published-and-unexpired rows (§5.5) — a draft or
  // paused job would silently vanish. The admin client bypasses RLS; the
  // `.eq("company_id", companyId)` below is the real security boundary,
  // same convention every cross-session read in this codebase already uses.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, slug, title, status, language, published_at, expires_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    language: row.language,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    path: `/${row.language}/jobs/${row.slug}`,
  }));
}

export type ApiJobDetail = {
  id: string;
  slug: string;
  path: string;
  status: JobRow["status"];
  title: string;
  description: string;
  language: "pt" | "en";
  seniority: Job["seniority"];
  workModel: Job["workModel"];
  locationSlug: string | null;
  categorySlug: string | null;
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: Job["salaryPeriod"];
  salaryMonths: number | null;
  employmentType: Job["employmentType"];
  techTags: { slug: string; level: SkillLevel | null; required: boolean }[];
  languages: { slug: string; level: SkillLevel | null }[];
  externalApplyUrl: string | null;
  salaryPublic: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
};

type ApiJobDetailRow = {
  id: string;
  slug: string;
  status: JobRow["status"];
  title: string;
  description: string;
  language: "pt" | "en";
  seniority: Job["seniority"];
  work_model: Job["workModel"];
  salary_min: number;
  salary_max: number;
  salary_period: Job["salaryPeriod"];
  salary_months: number | null;
  employment_type: Job["employmentType"];
  external_apply_url: string | null;
  salary_public: boolean;
  published_at: string | null;
  expires_at: string | null;
  job_categories: { slug: string } | null;
  locations: { slug: string } | null;
  job_tech_tags: { level: SkillLevel | null; required: boolean; tech_tags: { slug: string } }[];
  job_languages: { level: SkillLevel | null; spoken_languages: { slug: string } }[];
};

export async function getCompanyJobById(companyId: string, jobId: string): Promise<ApiJobDetail | null> {
  // Same reasoning as `getAllCompanyJobsForApi` above — admin client,
  // `.eq("company_id", companyId)` is the real guard.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      `id, slug, status, title, description, language, seniority, work_model, salary_min, salary_max,
       salary_period, salary_months, employment_type, external_apply_url, salary_public, published_at,
       expires_at, job_categories ( slug ), locations ( slug ),
       job_tech_tags ( level, required, tech_tags ( slug ) ),
       job_languages ( level, spoken_languages ( slug ) )`,
    )
    .eq("id", jobId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as ApiJobDetailRow;
  return {
    id: row.id,
    slug: row.slug,
    path: `/${row.language}/jobs/${row.slug}`,
    status: row.status,
    title: row.title,
    description: row.description,
    language: row.language,
    seniority: row.seniority,
    workModel: row.work_model,
    locationSlug: row.locations?.slug ?? null,
    categorySlug: row.job_categories?.slug ?? null,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryPeriod: row.salary_period,
    salaryMonths: row.salary_months,
    employmentType: row.employment_type,
    techTags: row.job_tech_tags.map((t) => ({ slug: t.tech_tags.slug, level: t.level, required: t.required })),
    languages: row.job_languages.map((l) => ({ slug: l.spoken_languages.slug, level: l.level })),
    externalApplyUrl: row.external_apply_url,
    salaryPublic: row.salary_public,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
  };
}
