import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Employer analytics, phase 1: real numbers already sitting in the
// database (job views, apply-button clicks, completed applications),
// surfaced as a dashboard instead of left as a bare per-row counter.
// Deliberately scoped to what's already instrumented — no new visitor-
// tracking infrastructure, no company-profile-page views, no followers/
// reviews (all a separate, bigger piece of work).

export type JobAnalyticsRow = {
  jobId: string;
  jobTitle: string;
  status: "draft" | "published" | "inactive" | "closed";
  views: number;
  applyClicks: number;
  applications: number;
};

export type AnalyticsTrendPoint = { date: string; views: number; applyClicks: number };

export type CompanyAnalytics = {
  totals: { views: number; applyClicks: number; applications: number };
  jobs: JobAnalyticsRow[];
  trend: AnalyticsTrendPoint[];
};

const TREND_DAYS = 30;

/** Pure, unit-testable on its own: buckets raw `events` rows (just
 *  `type`/`created_at`) into one point per calendar day (UTC) for the
 *  last `days` days, oldest first, zero-filled for a day with no events
 *  at all. A trend chart with gaps for quiet days reads as "no data for
 *  this day," which is the wrong story — a real quiet day is a zero, not
 *  a hole. `now` is a parameter (not read internally) so this is exactly
 *  reproducible in a test, not dependent on the clock at call time. */
export function bucketEventsByDay(
  events: { type: string; created_at: string }[],
  days: number,
  now: Date = new Date(),
): AnalyticsTrendPoint[] {
  const points = new Map<string, AnalyticsTrendPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.set(key, { date: key, views: 0, applyClicks: 0 });
  }
  for (const e of events) {
    const key = e.created_at.slice(0, 10);
    const point = points.get(key);
    if (!point) continue; // outside the requested window
    if (e.type === "job.viewed") point.views += 1;
    else if (e.type === "job.apply_clicked") point.applyClicks += 1;
  }
  return Array.from(points.values());
}

type JobAnalyticsSelectRow = {
  id: string;
  title: string;
  status: JobAnalyticsRow["status"];
  view_count: number;
  apply_click_count: number;
  applications: { count: number }[];
};

/** Per-job rows are a plain RLS-scoped read (same "employers see their
 *  own company's jobs" policy every other console query already relies
 *  on). The trend needs `events`, which has zero client grants at all
 *  (see `events.ts`'s own comment) — admin client there, scoped in
 *  application code by `payload->>company_id`, the same discipline this
 *  project already uses for every other admin-client read. */
export async function getCompanyAnalytics(companyId: string): Promise<CompanyAnalytics> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, title, status, view_count, apply_click_count, applications(count)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const rows = (data as unknown as JobAnalyticsSelectRow[] | null) ?? [];
  const jobs: JobAnalyticsRow[] = rows.map((row) => ({
    jobId: row.id,
    jobTitle: row.title,
    status: row.status,
    views: row.view_count,
    applyClicks: row.apply_click_count,
    applications: row.applications[0]?.count ?? 0,
  }));

  const totals = jobs.reduce(
    (acc, job) => ({
      views: acc.views + job.views,
      applyClicks: acc.applyClicks + job.applyClicks,
      applications: acc.applications + job.applications,
    }),
    { views: 0, applyClicks: 0, applications: 0 },
  );

  const since = new Date(Date.now() - TREND_DAYS * 86_400_000).toISOString();
  const admin = createAdminClient();
  const { data: eventRows } = await admin
    .from("events")
    .select("type, created_at")
    .eq("payload->>company_id", companyId)
    .in("type", ["job.viewed", "job.apply_clicked"])
    .gte("created_at", since);

  const trend = bucketEventsByDay(eventRows ?? [], TREND_DAYS);

  return { totals, jobs, trend };
}
