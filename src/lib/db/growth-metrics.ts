import { createAdminClient } from "@/lib/supabase/admin";
import type { VerificationStatus } from "@/lib/db/companies";

/**
 * The "going to market" business-health dashboard behind `/growth`: real
 * candidate/company/job/revenue counts, platform-wide, same admin-client-
 * for-a-platform-wide-read discipline `assistant-analytics.ts` already
 * established (no RLS policy could scope this anyway, it deliberately
 * spans every company/candidate). Gated by its own secret at the page
 * layer, not here; this module has no opinion on who's allowed to call it.
 */

const TREND_DAYS = 30;

export type SignupTrendPoint = { date: string; candidates: number; companies: number };

/** Pure, unit-testable day-bucketing, deliberately a separate sibling of
 *  `bucketAssistantEventsByDay`/`bucketEventsByDay` rather than a shared
 *  generalization, matching this project's own standing precedent of
 *  duplicating a small bucketing function per feature instead of widening
 *  an unrelated one (see job-analytics.ts/assistant-analytics.ts). */
export function bucketSignupsByDay(
  candidateDates: string[],
  companyDates: string[],
  days: number,
  now: Date = new Date(),
): SignupTrendPoint[] {
  const points = new Map<string, SignupTrendPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.set(key, { date: key, candidates: 0, companies: 0 });
  }
  for (const dateStr of candidateDates) {
    const point = points.get(dateStr.slice(0, 10));
    if (point) point.candidates += 1;
  }
  for (const dateStr of companyDates) {
    const point = points.get(dateStr.slice(0, 10));
    if (point) point.companies += 1;
  }
  return Array.from(points.values());
}

export type ClientStatus = "active" | "dormant" | "never_activated";

export type ClientRow = {
  companyId: string;
  companyName: string;
  status: ClientStatus;
  liveJobCount: number;
  lastPublishedAt: string | null;
};

export type GrowthMetrics = {
  totals: {
    candidates: number;
    companies: number;
    verifiedCompanies: number;
    liveJobs: number;
    applicationsEver: number;
    favorites: number;
    savedSearches: number;
  };
  companiesByStatus: Record<VerificationStatus, number>;
  newLast30Days: { candidates: number; verifiedCompanies: number; jobsPublished: number };
  signupTrend: SignupTrendPoint[];
  clients: ClientRow[];
  billing: {
    adCreditRevenueCents: number;
    activeTopEmployerCount: number;
    everPaidCompanyCount: number;
  };
};

export async function getGrowthMetrics(): Promise<GrowthMetrics> {
  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - TREND_DAYS * 86_400_000);
  const nowIso = now.toISOString();

  const [
    { count: candidatesCount },
    { data: candidateDates },
    { data: companiesAll },
    { count: liveJobsCount },
    { count: applicationsCount },
    { count: favoritesCount },
    { count: savedSearchesCount },
    { data: jobRows },
    { data: adPurchases },
    { data: subRows },
  ] = await Promise.all([
    admin.from("candidates").select("id", { count: "exact", head: true }),
    admin.from("candidates").select("created_at").gte("created_at", windowStart.toISOString()),
    admin.from("companies").select("id, company_name, verification_status, created_at, top_employer_active"),
    admin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "published").gt("expires_at", nowIso),
    admin.from("applications").select("id", { count: "exact", head: true }),
    admin.from("favorites").select("id", { count: "exact", head: true }),
    admin.from("saved_searches").select("id", { count: "exact", head: true }),
    admin.from("jobs").select("company_id, status, published_at, expires_at"),
    admin.from("job_ad_purchases").select("company_id, total_cents"),
    admin.from("company_subscriptions").select("company_id, status"),
  ]);

  const companies = companiesAll ?? [];
  const jobs = jobRows ?? [];

  const companiesByStatus: Record<VerificationStatus, number> = {
    unverified: 0,
    pending: 0,
    verified: 0,
    failed: 0,
    unclaimed: 0,
  };
  for (const c of companies) companiesByStatus[c.verification_status as VerificationStatus] += 1;

  // Per-company job facts, computed once over the already-fetched `jobs`
  // array rather than one query per company.
  const jobsByCompany = new Map<string, { status: string; publishedAt: string | null; expiresAt: string | null }[]>();
  for (const j of jobs) {
    const list = jobsByCompany.get(j.company_id) ?? [];
    list.push({ status: j.status, publishedAt: j.published_at, expiresAt: j.expires_at });
    jobsByCompany.set(j.company_id, list);
  }

  const verifiedCompanies = companies.filter((c) => c.verification_status === "verified");

  const clients: ClientRow[] = verifiedCompanies
    .map((c) => {
      const companyJobs = jobsByCompany.get(c.id) ?? [];
      const liveJobs = companyJobs.filter((j) => j.status === "published" && j.expiresAt && j.expiresAt > nowIso);
      const everPublished = companyJobs.filter((j) => j.publishedAt);
      const lastPublishedAt = everPublished.reduce<string | null>(
        (max, j) => (j.publishedAt && (!max || j.publishedAt > max) ? j.publishedAt : max),
        null,
      );
      const status: ClientStatus = liveJobs.length > 0 ? "active" : everPublished.length > 0 ? "dormant" : "never_activated";
      return { companyId: c.id, companyName: c.company_name, status, liveJobCount: liveJobs.length, lastPublishedAt };
    })
    .sort((a, b) => {
      const rank = { active: 0, dormant: 1, never_activated: 2 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return (b.lastPublishedAt ?? "").localeCompare(a.lastPublishedAt ?? "");
    });

  const jobsPublishedLast30 = jobs.filter((j) => j.published_at && j.published_at >= windowStart.toISOString()).length;
  const newVerifiedCompanies = companies.filter(
    (c) => c.verification_status === "verified" && c.created_at >= windowStart.toISOString(),
  ).length;

  const signupTrend = bucketSignupsByDay(
    (candidateDates ?? []).map((r) => r.created_at),
    companies.filter((c) => c.created_at >= windowStart.toISOString()).map((c) => c.created_at),
    TREND_DAYS,
    now,
  );

  const adCreditRevenueCents = (adPurchases ?? []).reduce((sum, p) => sum + p.total_cents, 0);
  const activeTopEmployerCount = companies.filter((c) => c.top_employer_active).length;
  const payingCompanyIds = new Set<string>();
  for (const p of adPurchases ?? []) payingCompanyIds.add(p.company_id);
  for (const s of subRows ?? []) payingCompanyIds.add(s.company_id);

  return {
    totals: {
      candidates: candidatesCount ?? 0,
      companies: companies.length,
      verifiedCompanies: verifiedCompanies.length,
      liveJobs: liveJobsCount ?? 0,
      applicationsEver: applicationsCount ?? 0,
      favorites: favoritesCount ?? 0,
      savedSearches: savedSearchesCount ?? 0,
    },
    companiesByStatus,
    newLast30Days: {
      candidates: (candidateDates ?? []).length,
      verifiedCompanies: newVerifiedCompanies,
      jobsPublished: jobsPublishedLast30,
    },
    signupTrend,
    clients,
    billing: {
      adCreditRevenueCents,
      activeTopEmployerCount,
      everPaidCompanyCount: payingCompanyIds.size,
    },
  };
}
