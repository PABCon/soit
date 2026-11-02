import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { savedSearchDigestEmail } from "@/lib/email/templates/saved-search-digest";
import { savedSearchHref, type SearchQuery } from "@/lib/db/saved-searches";
import { SELECT, toJob, hideSalaryIfPrivate, type JobRow } from "@/lib/db/jobs";
import { parseJobFilterParams, jobMatchesFilters } from "@/lib/jobs/match-filters";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type SavedSearchRow = {
  id: string;
  candidate_id: string;
  label: string;
  query: SearchQuery;
  created_at: string;
  last_notified_at: string | null;
};

type LocationRow = { id: string; slug: string; latitude: number; longitude: number };

/**
 * Daily saved-search digest (real-usage QA item) — run by a Vercel Cron
 * hitting `/api/cron/saved-search-digest`. One job fetch and one location
 * fetch shared across every saved search (the whole live feed is small
 * enough that this beats N separate per-search queries), then the exact
 * same filter predicate `JobsExplorer`'s client-side filter uses
 * (`src/lib/jobs/match-filters.ts`, shared rather than reimplemented here
 * a second time — a real bug this project already hit once with just
 * `q`/`near`, fixed by extracting one predicate both sides call) — a
 * candidate should never see "new matches" in an email that don't
 * actually match what clicking through to the search itself would show.
 *
 * Uses the same `SELECT`/`toJob()`/`hideSalaryIfPrivate()` the public
 * `/jobs` feed itself reads through (not a second, narrower column list)
 * so every filter dimension (tech, category, seniority, salary, work
 * model, languages, …) is available here, not just the few fields an
 * earlier, bespoke digest query happened to select.
 *
 * `last_notified_at` (falling back to the search's own `created_at` on
 * its first run) is the low-water mark for "new" — advanced to "now" on
 * every run regardless of whether anything matched, so a quiet week
 * doesn't cause old jobs to resurface once one finally matches.
 */
export async function runSavedSearchDigest(): Promise<{ searchesChecked: number; emailsSent: number }> {
  const admin = createAdminClient();

  const { data: searches } = await admin
    .from("saved_searches")
    .select("id, candidate_id, label, query, created_at, last_notified_at")
    .eq("notify_opt_in", true);
  if (!searches || searches.length === 0) return { searchesChecked: 0, emailsSent: 0 };

  const [{ data: jobRows }, { data: locations }, { data: candidates }] = await Promise.all([
    admin
      .from("jobs")
      .select(SELECT)
      .eq("status", "published")
      .gt("expires_at", new Date().toISOString()),
    admin.from("locations").select("id, slug, latitude, longitude"),
    admin.from("candidates").select("id, email").in(
      "id",
      (searches as SavedSearchRow[]).map((s) => s.candidate_id),
    ),
  ]);

  const jobs = ((jobRows as unknown as JobRow[] | null) ?? []).map((row) => ({
    row,
    job: hideSalaryIfPrivate(row, toJob(row)),
    postedAt: row.published_at ?? row.created_at,
  }));

  const locationBySlug = new Map((locations as LocationRow[] | null ?? []).map((l) => [l.slug, l]));
  const emailByCandidateId = new Map((candidates ?? []).map((c) => [c.id, c.email as string]));
  const now = new Date().toISOString();

  let emailsSent = 0;
  for (const search of searches as SavedSearchRow[]) {
    const since = search.last_notified_at ?? search.created_at;
    const filters = parseJobFilterParams(new URLSearchParams(search.query));
    const nearLocation = filters.near ? (locationBySlug.get(filters.near) ?? null) : null;

    const matches = jobs.filter(
      ({ job, postedAt }) => postedAt > since && jobMatchesFilters(job, filters, nearLocation),
    );

    const email = emailByCandidateId.get(search.candidate_id);
    if (matches.length > 0 && email) {
      await sendEmail(
        savedSearchDigestEmail({
          to: email,
          searchLabel: search.label,
          jobs: matches.map(({ job }) => ({
            title: job.title,
            companyName: job.company.name,
            companyLogoUrl: job.company.logoUrl ?? null,
            url: `${SITE}/pt/jobs/${job.slug}`,
          })),
          searchUrl: `${SITE}/pt${savedSearchHref(search.query)}`,
        }),
      );
      emailsSent++;
    }

    await admin.from("saved_searches").update({ last_notified_at: now }).eq("id", search.id);
  }

  return { searchesChecked: searches.length, emailsSent };
}
