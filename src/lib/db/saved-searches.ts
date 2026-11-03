import { createClient } from "@/lib/supabase/server";

/** Every active `/jobs` URL param at the moment the search was saved —
 *  deliberately a plain string map, not a fixed `{q, near, radiusKm}`
 *  struct (the pre-fix shape). That fixed shape is exactly what caused a
 *  real bug: a saved search could only ever capture a keyword/location,
 *  silently dropping every other filter (salary, remote, work model,
 *  tech, etc.) both from what got saved and from what the digest cron
 *  matched against. A plain map needs no schema change here or in the
 *  digest whenever `/jobs` gains a new filter param. */
export type SearchQuery = Record<string, string>;

export type SavedSearch = {
  id: string;
  label: string;
  query: SearchQuery;
  createdAt: string;
  notifyOptIn: boolean;
};

/** Builds the URL query string a saved search re-runs against — kept here,
 *  next to the type it operates on, so the /jobs link and the delete/list
 *  UI can't drift apart from what was actually saved. Every stored key
 *  round-trips verbatim — no per-field logic to keep in sync as `/jobs`
 *  gains filters. */
export function savedSearchHref(query: SearchQuery): string {
  const qs = new URLSearchParams(query).toString();
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

export type SetNotifyOptInResult = { ok: true } | { ok: false; reason: "not_a_candidate" | "db_error" };

/** Real bug, reproduced live: this threw on any failure (originally a
 *  missing `update` grant on the table — see the grant migration), and
 *  since it's invoked from a client component with no try/catch at the
 *  call site, that throw crashed the whole page. Returns a typed result
 *  instead, same pattern as `saveSearch()` above, so a future transient
 *  DB hiccup degrades to a reverted toggle instead of a crash. */
export async function setSavedSearchNotifyOptIn(id: string, optIn: boolean): Promise<SetNotifyOptInResult> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };

  const { error } = await supabase
    .from("saved_searches")
    .update({ notify_opt_in: optIn })
    .eq("id", id)
    .eq("candidate_id", candidateId);
  if (error) return { ok: false, reason: "db_error" };
  return { ok: true };
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
