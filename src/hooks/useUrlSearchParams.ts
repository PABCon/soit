"use client";

import { useSyncExternalStore } from "react";

const PARAMS_EVENT = "soit:search-params-change";

// Deliberately NOT next/navigation's useSearchParams()/router.replace(): on
// a fully dynamic page (no static generation — fetches fresh on every
// request), Next's client router treats ANY searchParams-only navigation as
// needing a real RSC round trip to the server — confirmed via a network
// capture showing a ~650ms `GET /jobs?tech=...&_rsc=...` on every single
// chip click in production (never showed up locally, where that round trip
// is ~0ms to a same-machine dev server) — even when the page's own
// data-fetching never reads those params at all, as with JobsExplorer
// (real usage QA round 3, phase 4). Reading/writing the URL directly via
// the History API keeps same-page filter/search updates truly instant
// while still giving shareable/bookmarkable URLs. `replaceState` never
// fires `popstate` in the tab that called it, hence the custom event
// alongside it for same-tab reactivity — same pattern Rail.tsx's collapse
// state already uses for the same reason.
let cachedSearch: string | undefined;
let cachedParams: URLSearchParams | undefined;
function getSnapshot(): URLSearchParams {
  const search = window.location.search;
  if (search !== cachedSearch) {
    cachedSearch = search;
    cachedParams = new URLSearchParams(search);
  }
  return cachedParams!;
}
// A stable, shared instance — returning a fresh `new URLSearchParams()`
// every call is exactly the anti-pattern useSyncExternalStore warns about
// ("The result of getServerSnapshot should be cached").
const EMPTY_PARAMS = new URLSearchParams();
function getServerSnapshot(): URLSearchParams {
  return EMPTY_PARAMS;
}
function subscribe(callback: () => void) {
  window.addEventListener(PARAMS_EVENT, callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener(PARAMS_EVENT, callback);
    window.removeEventListener("popstate", callback);
  };
}

/** Reads the current page's query string reactively, without next/
 *  navigation's useSearchParams(). Only meaningful for reading/updating
 *  the page you're already on — navigating to a *different* page still
 *  needs a real router.push()/Link. */
export function useUrlSearchParams(): URLSearchParams {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Replaces the current page's query string in place — no navigation, no
 *  server round trip, just the History API plus a same-tab event so every
 *  useUrlSearchParams() subscriber (anywhere on the page) re-renders. */
export function writeUrlSearchParams(next: URLSearchParams) {
  const qs = next.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(PARAMS_EVENT));
}

export function parseListParam(sp: URLSearchParams, key: string): string[] {
  const v = sp.get(key);
  return v ? v.split(",").filter(Boolean) : [];
}
