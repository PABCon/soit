"use client";

import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useUrlSearchParams, writeUrlSearchParams } from "@/hooks/useUrlSearchParams";
import { saveSearchAction } from "@/app/[locale]/(candidate)/saved-searches/actions";
import type { LocationOption } from "@/lib/db/locations";

const RADIUS_OPTIONS = [10, 25, 50, 100];
const MAX_SUGGESTIONS = 6;

export type SearchSuggestion = { label: string; kind: "tech" | "category" };

/** Global search (§7.1 phase 5) — title keyword + "near a curated city
 *  within N km" (Haversine over the already-fetched job list in
 *  JobsExplorer, no geocoding provider — see its own comment). Lives in
 *  TopNav so it's reachable from anywhere, not just /jobs: submitting from
 *  elsewhere does a real navigation to /jobs (correct — a genuinely new
 *  page); submitting while already on /jobs updates the URL in place via
 *  the same instant, no-round-trip mechanism JobsExplorer's own filters
 *  use, preserving whatever chip filters are already active there. */
export function SearchBar({
  locations,
  suggestions,
}: {
  locations: LocationOption[];
  suggestions: SearchSuggestion[];
}) {
  const pathname = usePathname();
  // SearchBar lives in a persistent layout (TopNav), so it never remounts
  // on navigation — a plain useState lazy initializer would only ever run
  // once. Real-usage report: the typed search stayed in the box even
  // after navigating away to an unrelated page and back. Forcing a real
  // remount via `key` (React's own recommended pattern for "reset state
  // when some outside signal changes", see react.dev/learn/you-might-not-
  // need-an-effect) re-runs every lazy initializer below fresh on each
  // navigation — no effect needed.
  return <SearchBarFields key={pathname} pathname={pathname} locations={locations} suggestions={suggestions} />;
}

function SearchBarFields({
  pathname,
  locations,
  suggestions,
}: {
  pathname: string;
  locations: LocationOption[];
  suggestions: SearchSuggestion[];
}) {
  const t = useTranslations("nav");
  const router = useRouter();
  const urlParams = useUrlSearchParams();
  const onJobsPage = pathname === "/jobs";

  const [q, setQ] = useState(() => (onJobsPage ? (urlParams.get("q") ?? "") : ""));
  const [near, setNear] = useState(() => (onJobsPage ? (urlParams.get("near") ?? "") : ""));
  const [radiusKm, setRadiusKm] = useState(() => (onJobsPage ? (urlParams.get("radiusKm") ?? "25") : "25"));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const canSave = q.trim() !== "" || near !== "";

  // "Search-bar autocomplete/suggestions" (real-usage QA item) — matches
  // against the two curated vocabularies this app already has (tech
  // tags, job categories), not every job title ever posted: suggesting a
  // term that's actually part of a controlled vocabulary means picking
  // it is guaranteed to mean something, unlike a free-text guess.
  const filteredSuggestions = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return suggestions.filter((s) => s.label.toLowerCase().includes(query)).slice(0, MAX_SUGGESTIONS);
  }, [suggestions, q]);

  function runSearch(qValue: string) {
    const patch = new URLSearchParams();
    if (qValue.trim()) patch.set("q", qValue.trim());
    if (near) {
      patch.set("near", near);
      patch.set("radiusKm", radiusKm);
    }

    if (onJobsPage) {
      // A fresh keyword/location search shouldn't silently drop whatever
      // tech/category/etc. chip filters are already active on the page.
      const merged = new URLSearchParams(urlParams.toString());
      merged.delete("q");
      merged.delete("near");
      merged.delete("radiusKm");
      for (const [key, value] of patch) merged.set(key, value);
      writeUrlSearchParams(merged);
    } else {
      const qs = patch.toString();
      router.push(qs ? `/jobs?${qs}` : "/jobs");
    }
    setSaveState("idle");
    setSuggestionsOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(q);
  }

  function selectSuggestion(label: string) {
    setQ(label);
    runSearch(label);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen || filteredSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % filteredSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + filteredSuggestions.length) % filteredSuggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectSuggestion(filteredSuggestions[highlighted].label);
    } else if (e.key === "Escape") {
      setSuggestionsOpen(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaveState("saving");
    const place = locations.find((l) => l.slug === near)?.name;
    const label = [q.trim() && `"${q.trim()}"`, place].filter(Boolean).join(" · ") || t("search");
    const result = await saveSearchAction(
      { q: q.trim() || null, near: near || null, radiusKm: near ? Number(radiusKm) : null },
      label,
    );
    setSaveState(result.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={handleSubmit} className="hidden min-w-0 max-w-xl flex-1 items-center gap-1.5 sm:flex">
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSuggestionsOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onBlur={() => setSuggestionsOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder={t("search")}
          role="combobox"
          aria-expanded={suggestionsOpen && filteredSuggestions.length > 0}
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          autoComplete="off"
          className="h-9 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-sm placeholder:text-muted"
        />
        {suggestionsOpen && filteredSuggestions.length > 0 && (
          <ul
            id="search-suggestions"
            role="listbox"
            className="absolute top-full left-0 z-20 mt-1 w-full min-w-48 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-md"
          >
            {filteredSuggestions.map((s, i) => (
              <li key={`${s.kind}-${s.label}`} role="option" aria-selected={i === highlighted}>
                <button
                  type="button"
                  // onMouseDown, not onClick: fires before the input's own
                  // onBlur, so the suggestion is still in the DOM (and
                  // this handler runs) when the click lands — onClick
                  // alone would lose the race to blur closing the list.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(s.label);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                    i === highlighted ? "bg-paper text-ink" : "text-ink"
                  }`}
                >
                  {s.label}
                  <span className="text-[10px] text-muted uppercase">
                    {s.kind === "tech" ? t("suggestionKindTech") : t("suggestionKindCategory")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <select
        value={near}
        onChange={(e) => setNear(e.target.value)}
        className="h-9 shrink-0 rounded-lg border border-line bg-white px-2 text-xs text-ink"
      >
        <option value="">{t("searchAnywhere")}</option>
        {locations.map((l) => (
          <option key={l.id} value={l.slug}>
            {l.name}
          </option>
        ))}
      </select>
      {near && (
        <label className="flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted">
          {t("searchRadiusLabel")}
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            className="h-9 shrink-0 rounded-lg border border-line bg-white px-2 text-xs text-ink"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        className="h-9 shrink-0 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90"
      >
        {t("searchSubmit")}
      </button>
      {saveState === "saved" ? (
        <Link
          href="/saved-searches"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-pine hover:underline"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M6 4h12v16l-6-4-6 4V4Z" />
          </svg>
          {t("saveSearchSaved")}
        </Link>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saveState === "saving"}
          title={saveState === "error" ? t("saveSearchError") : t("saveSearchHint")}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted transition-colors hover:bg-paper hover:text-pine disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4h12v16l-6-4-6 4V4Z" />
          </svg>
          <span className="hidden lg:inline">{t("saveSearch")}</span>
        </button>
      )}
      {saveState === "error" && (
        <span className="shrink-0 text-xs text-red-700">{t("saveSearchError")}</span>
      )}
    </form>
  );
}
