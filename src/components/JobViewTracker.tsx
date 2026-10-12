"use client";

import { useEffect, useRef } from "react";

/** Fires exactly once, from a real client-side mount — never from server
 *  rendering or a `<Link>` prefetch. Prefetching fetches a page's RSC
 *  payload in the background but never mounts/hydrates its Client
 *  Components or runs their effects, so this `useEffect` only ever runs
 *  for a genuine, displayed visit — the same distinction this project
 *  already learned the hard way twice (the footer-prefetch login bug,
 *  the filter-chip round-trip bug). `sendBeacon` so the request survives
 *  an immediate navigation away and never blocks anything on the page.
 *
 *  A real bug caught by this round's own live verification: React's dev-
 *  mode Strict Mode deliberately double-invokes every effect (mount →
 *  cleanup → mount again) to surface exactly this class of non-idempotent
 *  effect — confirmed live via two real `POST .../view` network requests
 *  for one single page load, dev-only (production never double-invokes).
 *  Guarded with a ref so the real request only ever fires once per true
 *  mount regardless — a `useEffect` cleanup alone can't suppress a
 *  same-render re-invocation; the ref persists across it. */
export function JobViewTracker({ jobId }: { jobId: string }) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    try {
      const url = `/api/jobs/${jobId}/view`;
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url);
      } else {
        fetch(url, { method: "POST", keepalive: true });
      }
    } catch {
      // A missed view count is never worth breaking the page over.
    }
  }, [jobId]);

  return null;
}
