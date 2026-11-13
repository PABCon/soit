import { createAdminClient } from "@/lib/supabase/admin";

// Chat assistant usage tracking: the same "log to the existing events
// table, bucket into a dashboard" pattern job-analytics.ts already
// established for employer analytics, applied to a platform-wide feature
// instead of a per-company one. No new infrastructure: the two event
// types (assistant.message_sent/assistant.search_performed) are written
// from src/app/api/assistant/route.ts via the same logEvent() helper.

export type AssistantTrendPoint = { date: string; messages: number; searches: number };

export type AssistantAnalytics = {
  totals: { sessions: number; messages: number; searches: number; zeroResultSearches: number };
  topCategories: { slug: string; count: number }[];
  trend: AssistantTrendPoint[];
  /** Null once there's real history for the full `TREND_DAYS` window;
   *  otherwise the real calendar day day-level tracking began (this
   *  feature's own ship date), mirroring job-analytics.ts's identical
   *  "don't render a fabricated flat-zero stretch before real data
   *  existed" reasoning. */
  trackingStartedAt: string | null;
};

const TREND_DAYS = 30;
const TRACKED_TYPES = ["assistant.message_sent", "assistant.search_performed"];

/** Pure, unit-testable on its own, same shape as job-analytics.ts's
 *  bucketEventsByDay, a deliberately separate sibling rather than a
 *  generalized shared function: the two features track different event
 *  types and fields, and this project's own precedent (CompanyMap
 *  duplicating JobMap's effect split, the termination calculator's own
 *  money.ts) is to keep an already-shipped, tested module untouched
 *  rather than widen it for an unrelated feature. */
export function bucketAssistantEventsByDay(
  events: { type: string; created_at: string }[],
  days: number,
  now: Date = new Date(),
  trackingStartedAt?: Date,
): AssistantTrendPoint[] {
  const startKey = trackingStartedAt ? trackingStartedAt.toISOString().slice(0, 10) : null;
  const points = new Map<string, AssistantTrendPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (startKey && key < startKey) continue;
    points.set(key, { date: key, messages: 0, searches: 0 });
  }
  for (const e of events) {
    const key = e.created_at.slice(0, 10);
    const point = points.get(key);
    if (!point) continue;
    if (e.type === "assistant.message_sent") point.messages += 1;
    else if (e.type === "assistant.search_performed") point.searches += 1;
  }
  return Array.from(points.values());
}

async function getTrackingStartDate(): Promise<Date | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("created_at")
    .in("type", TRACKED_TYPES)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? new Date(data.created_at) : null;
}

/** `events` has zero client grants at all (see events.ts's own comment),
 *  always the admin client, same discipline every other reader of this
 *  table already follows. This is a platform-wide read (not scoped to one
 *  company), appropriate for the internal stats page this feeds, which is
 *  itself gated by a shared secret rather than any per-tenant RLS. */
export async function getAssistantAnalytics(): Promise<AssistantAnalytics> {
  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - TREND_DAYS * 86_400_000);

  const [{ data: windowRows }, { data: allRows }, trackingStartedAt] = await Promise.all([
    admin
      .from("events")
      .select("type, created_at")
      .in("type", TRACKED_TYPES)
      .gte("created_at", windowStart.toISOString()),
    admin.from("events").select("type, payload").in("type", TRACKED_TYPES),
    getTrackingStartDate(),
  ]);

  const rows = allRows ?? [];
  const sessionIds = new Set<string>();
  let messages = 0;
  let searches = 0;
  let zeroResultSearches = 0;
  const categoryCounts = new Map<string, number>();

  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    if (typeof payload.sessionId === "string") sessionIds.add(payload.sessionId);
    if (row.type === "assistant.message_sent") {
      messages += 1;
    } else if (row.type === "assistant.search_performed") {
      searches += 1;
      if (payload.resultCount === 0) zeroResultSearches += 1;
      if (typeof payload.categorySlug === "string") {
        categoryCounts.set(payload.categorySlug, (categoryCounts.get(payload.categorySlug) ?? 0) + 1);
      }
    }
  }

  const topCategories = [...categoryCounts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const trend = bucketAssistantEventsByDay(windowRows ?? [], TREND_DAYS, new Date(), trackingStartedAt ?? undefined);

  return {
    totals: { sessions: sessionIds.size, messages, searches, zeroResultSearches },
    topCategories,
    trend,
    trackingStartedAt:
      trackingStartedAt && trackingStartedAt > windowStart ? trackingStartedAt.toISOString().slice(0, 10) : null,
  };
}
