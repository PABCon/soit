import { createAdminClient } from "@/lib/supabase/admin";
import { haversineKm } from "@/lib/geo";
import { sendEmail } from "@/lib/email/send";
import { savedSearchDigestEmail } from "@/lib/email/templates/saved-search-digest";
import { savedSearchHref, type SearchQuery } from "@/lib/db/saved-searches";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type SavedSearchRow = {
  id: string;
  candidate_id: string;
  label: string;
  query: SearchQuery;
  created_at: string;
  last_notified_at: string | null;
};

type DigestJobRow = {
  id: string;
  slug: string;
  title: string;
  published_at: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  location_id: string | null;
  companies: { company_name: string };
};

type LocationRow = { id: string; slug: string; latitude: number; longitude: number };

function jobMatchesQuery(job: DigestJobRow, query: SearchQuery, since: string, locationBySlug: Map<string, LocationRow>): boolean {
  const publishedAt = job.published_at ?? job.created_at;
  if (publishedAt <= since) return false;

  if (query.q && !job.title.toLowerCase().includes(query.q.toLowerCase())) return false;

  if (query.near) {
    const place = locationBySlug.get(query.near);
    if (!place) return false;

    if (query.radiusKm && query.radiusKm > 0) {
      if (job.latitude === null || job.longitude === null) return false;
      if (haversineKm(place.latitude, place.longitude, job.latitude, job.longitude) > query.radiusKm) return false;
    } else if (job.location_id !== place.id) {
      return false;
    }
  }

  return true;
}

/**
 * Daily saved-search digest (real-usage QA item) — run by a Vercel Cron
 * hitting `/api/cron/saved-search-digest`. One job fetch and one location
 * fetch shared across every saved search (the whole live feed is small
 * enough that this beats N separate per-search queries), then the exact
 * same keyword/near/radius matching semantics `JobsExplorer`'s client-side
 * filter already uses — a candidate should never see "new matches" in an
 * email that don't actually match what clicking through to the search
 * itself would show.
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

  const [{ data: jobs }, { data: locations }, { data: candidates }] = await Promise.all([
    admin
      .from("jobs")
      .select("id, slug, title, published_at, created_at, latitude, longitude, location_id, companies!inner(company_name)")
      .eq("status", "published")
      .gt("expires_at", new Date().toISOString()),
    admin.from("locations").select("id, slug, latitude, longitude"),
    admin.from("candidates").select("id, email").in(
      "id",
      (searches as SavedSearchRow[]).map((s) => s.candidate_id),
    ),
  ]);

  const locationBySlug = new Map((locations as LocationRow[] | null ?? []).map((l) => [l.slug, l]));
  const emailByCandidateId = new Map((candidates ?? []).map((c) => [c.id, c.email as string]));
  const now = new Date().toISOString();

  let emailsSent = 0;
  for (const search of searches as SavedSearchRow[]) {
    const since = search.last_notified_at ?? search.created_at;
    const matches = ((jobs as unknown as DigestJobRow[] | null) ?? []).filter((job) =>
      jobMatchesQuery(job, search.query, since, locationBySlug),
    );

    const email = emailByCandidateId.get(search.candidate_id);
    if (matches.length > 0 && email) {
      await sendEmail(
        savedSearchDigestEmail({
          to: email,
          searchLabel: search.label,
          jobs: matches.map((j) => ({ title: j.title, companyName: j.companies.company_name, url: `${SITE}/pt/jobs/${j.slug}` })),
          searchUrl: `${SITE}/pt${savedSearchHref(search.query)}`,
        }),
      );
      emailsSent++;
    }

    await admin.from("saved_searches").update({ last_notified_at: now }).eq("id", search.id);
  }

  return { searchesChecked: searches.length, emailsSent };
}
