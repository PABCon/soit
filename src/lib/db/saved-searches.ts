import { createClient } from "@/lib/supabase/server";

export type SearchQuery = {
  q: string | null;
  near: string | null;
  radiusKm: number | null;
};

export type SavedSearch = {
  id: string;
  label: string;
  query: SearchQuery;
  createdAt: string;
  notifyOptIn: boolean;
};

/** Builds the URL query string a saved search re-runs against — kept here,
 *  next to the type it operates on, so the /jobs link and the delete/list
 *  UI can't drift apart from what was actually saved. */
export function savedSearchHref(query: SearchQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.near) {
    params.set("near", query.near);
    if (query.radiusKm) params.set("radiusKm", String(query.radiusKm));
  }
  const qs = params.toString();
  return qs ? `/jobs?${qs}` : "/jobs";
}

export type SaveSearchResult = { ok: true } | { ok: false; reason: "not_a_candidate" | "db_error" };

/** Saves a candidate's own search — insert if new, no-op if this exact
 *  query is already saved (unique (candidate_id, query)). Saving IS
 *  opting into notifications (`notify_opt_in` defaults true on the
 *  column) — no separate checkbox in the already-cramped nav search bar;
 *  a per-row toggle on /saved-searches lets anyone turn it back off
 *  without deleting the search. The actual daily digest is
 *  `src/lib/notifications/saved-search-digest.ts`, run by a Vercel Cron.
 *
 *  Returns a result instead of throwing: unlike favorites' toggle (only
 *  ever reachable by a session already confirmed to be a candidate), the
 *  nav search bar's "save" button is visible to anyone, logged in or not
 *  — an anonymous visitor clicking it is a real, expected, common path,
 *  not an exceptional one, so it shouldn't surface as a framework-level
 *  500 in the server logs. */
export async function saveSearch(query: SearchQuery, label: string): Promise<SaveSearchResult> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };

  const { error } = await supabase
    .from("saved_searches")
    .upsert({ candidate_id: candidateId, query, label }, { onConflict: "candidate_id,query", ignoreDuplicates: true });
  if (error) return { ok: false, reason: "db_error" };
  return { ok: true };
}

export async function getMySavedSearches(): Promise<SavedSearch[]> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return [];

  const { data } = await supabase
    .from("saved_searches")
    .select("id, label, query, created_at, notify_opt_in")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    query: row.query as SearchQuery,
    createdAt: row.created_at,
    notifyOptIn: row.notify_opt_in,
  }));
}

export async function setSavedSearchNotifyOptIn(id: string, optIn: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  const { error } = await supabase
    .from("saved_searches")
    .update({ notify_opt_in: optIn })
    .eq("id", id)
    .eq("candidate_id", candidateId);
  if (error) throw new Error(error.message);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("candidate_id", candidateId);
  if (error) throw new Error(error.message);
}
