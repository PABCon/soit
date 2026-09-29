import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Real-usage feedback: an explicit "Save changes" button on every one of
 * the profile's ~7 independent sections meant clicking Save constantly
 * for even a small edit. Debounced autosave instead — ~800ms after the
 * last change to `value`, call `save(value)`. Skips the very first
 * render by default (the section's already-persisted initial state) so
 * mounting a section never fires a redundant save on data it didn't
 * actually change. Compares by `JSON.stringify` rather than reference
 * equality — these values are always small, freshly-built plain
 * objects/arrays, not large enough for that to matter, and it avoids
 * every call site having to memoize its own value.
 *
 * Pass `skipFirstRun: false` when `value`'s *initial* render is itself
 * already a real, unsaved change — e.g. a section that's just been
 * key-remounted with a freshly-parsed AI draft as its starting state.
 * Skipping the first run there would mean a candidate who's happy with
 * the draft and never edits it, just navigates to another tab, loses it
 * silently — the "first render" *is* the pending change in that case,
 * not the already-persisted baseline.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  delayMs = 800,
  options?: { skipFirstRun?: boolean },
): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const isFirstRun = useRef(options?.skipFirstRun ?? true);
  const serialized = JSON.stringify(value);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setStatus("pending");
    const handle = setTimeout(() => {
      setStatus("saving");
      save(value)
        .then(() => setStatus("saved"))
        .catch(() => setStatus("error"));
    }, delayMs);
    return () => clearTimeout(handle);
    // `serialized` is the real dependency (content, not reference) — `value`/`save`
    // are read fresh from closure when the timeout fires, never stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return status;
}
