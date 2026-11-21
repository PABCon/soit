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

// Known dev/QA fixtures left behind by earlier testing sessions that were
// never cleaned up (real-usage finding: this page surfaced them directly
// as "bad data"). Confirmed by direct inspection before excluding, not
// guessed from name patterns alone, each of these companies has zero
// jobs ever, and each of these candidates has a test-tool-generated
// email/name with zero real applications/favorites/saved searches. A
// genuinely ambiguous case (a candidate with a real CV and skills on
// file, even one you can't fully vouch for) is deliberately NOT excluded
// here, this list only holds confirmed, unambiguous fixtures. Filtering
// here (not deleting the rows) keeps this reversible and auditable; a
// real cleanup pass deleting them from the database is a separate,
// explicit action.
const EXCLUDED_COMPANY_IDS = new Set([
  "67212b85-15d2-4096-8754-5d66b77cb29b", // "QA GDPR Test Co 1793102836987"
  "197a4cc1-fe43-44ef-b2c5-038d1e5b063c", // "Matchmaking Test Co"
  "3cd24489-2507-4c71-ab1b-a52ddaf3c3b1", // "Matchmaking Test Co" (second fixture)
  "670fcc1a-0735-4061-9797-53a4f5a67035", // "Just IT" itself, a placeholder/demo row, zero real jobs
]);
const EXCLUDED_CANDIDATE_IDS = new Set([
  "b2f57e20-511e-41d9-b3d3-8e40d40e747c", // terms-test-...@mailinator.com
  "d92c5d9a-2124-4a93-8b07-ae18a267c6a2", // qa-apply-fix-...@example.com
  "7ada1958-37d4-435a-b4d9-4b0728ddac48", // interviewprep-test fixtures (4x)
  "383e3bc7-2f1b-4da6-9a1d-bf16d74bfe0a",
  "bbcb7927-19db-4a30-8bc8-be82ef9b605c",
  "33f2db9b-077d-4d16-896a-81e7ddfff4e6",
]);

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

/** A company that's been scraped + drafted (§claim-invites) but hasn't
 *  claimed its profile yet, exactly "other companies that should claim
 *  their accounts," the real-usage gap this section closes. */
export type ProspectRow = {
  companyId: string;
  companyName: string;
  createdAt: string;
  claimExpiresAt: string;
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
  prospects: ProspectRow[];
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
    { data: candidateRows },
    { data: companiesAll },
    { count: liveJobsCount },
    { count: applicationsCount },
    { count: favoritesCount },
    { count: savedSearchesCount },
    { data: jobRows },
    { data: adPurchases },
    { data: subRows },
    { data: claimInvites },
  ] = await Promise.all([
    admin.from("candidates").select("id, created_at"),
    admin.from("companies").select("id, company_name, verification_status, created_at, top_employer_active"),
    admin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "published").gt("expires_at", nowIso),
    admin.from("applications").select("id", { count: "exact", head: true }),
    admin.from("favorites").select("id", { count: "exact", head: true }),
    admin.from("saved_searches").select("id", { count: "exact", head: true }),
    admin.from("jobs").select("company_id, status, published_at, expires_at"),
    admin.from("job_ad_purchases").select("company_id, total_cents"),
    admin.from("company_subscriptions").select("company_id, status"),
    admin.from("company_claim_invites").select("company_id, expires_at, claimed_at"),
  ]);

  const candidates = (candidateRows ?? []).filter((c) => !EXCLUDED_CANDIDATE_IDS.has(c.id));
  const companies = (companiesAll ?? []).filter((c) => !EXCLUDED_COMPANY_IDS.has(c.id));
  const jobs = (jobRows ?? []).filter((j) => !EXCLUDED_COMPANY_IDS.has(j.company_id));

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

  // Unclaimed companies are exactly the ones with an open (unclaimed)
  // company_claim_invites row, joined in code rather than a Postgres
  // join, same "small table, compare in memory" style this project's
  // other admin-client reads already use (getFeaturedTechCounts, etc.).
  const unclaimedCompanyIds = new Set(companies.filter((c) => c.verification_status === "unclaimed").map((c) => c.id));
  const prospects: ProspectRow[] = (claimInvites ?? [])
    .filter((inv) => !inv.claimed_at && unclaimedCompanyIds.has(inv.company_id))
    .map((inv) => {
      const company = companies.find((c) => c.id === inv.company_id);
      return { companyId: inv.company_id, companyName: company?.company_name ?? "Unknown", createdAt: company?.created_at ?? inv.expires_at, claimExpiresAt: inv.expires_at };
    })
    .sort((a, b) => a.claimExpiresAt.localeCompare(b.claimExpiresAt));

  const jobsPublishedLast30 = jobs.filter((j) => j.published_at && j.published_at >= windowStart.toISOString()).length;
  const newVerifiedCompanies = companies.filter(
    (c) => c.verification_status === "verified" && c.created_at >= windowStart.toISOString(),
  ).length;

  const newCandidates = candidates.filter((c) => c.created_at >= windowStart.toISOString());
  const signupTrend = bucketSignupsByDay(
    newCandidates.map((r) => r.created_at),
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
      candidates: candidates.length,
      companies: companies.length,
      verifiedCompanies: verifiedCompanies.length,
      liveJobs: liveJobsCount ?? 0,
      applicationsEver: applicationsCount ?? 0,
      favorites: favoritesCount ?? 0,
      savedSearches: savedSearchesCount ?? 0,
    },
    companiesByStatus,
    newLast30Days: {
      candidates: newCandidates.length,
      verifiedCompanies: newVerifiedCompanies,
      jobsPublished: jobsPublishedLast30,
    },
    signupTrend,
    clients,
    prospects,
    billing: {
      adCreditRevenueCents,
      activeTopEmployerCount,
      everPaidCompanyCount: payingCompanyIds.size,
    },
  };
}
