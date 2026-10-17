"use client";

import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Search, MapPin, ChevronDown } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/Button";
import { Dropdown } from "@/components/Dropdown";
import { useUrlSearchParams, writeUrlSearchParams } from "@/hooks/useUrlSearchParams";
import { saveSearchAction } from "@/app/[locale]/(candidate)/saved-searches/actions";
import type { LocationOption } from "@/lib/db/locations";

const RADIUS_OPTIONS = [10, 25, 50, 100];
const MAX_SUGGESTIONS = 6;

export type SearchSuggestion = { label: string; kind: "tech" | "category" };

/** Real-usage QA item: the native `<select>` this replaced had its OS
 *  popup expand leftward over the search input when there wasn't room to
 *  its right (a real browser-level anchoring quirk, not something CSS on
 *  a native `<select>` can control). Same fix as `StatusDropdown`
 *  (`AllApplicantsList.tsx`) — a portal-rendered `Dropdown` this app
 *  fully controls the position of. `align="left"` anchors the panel's
 *  left edge to the trigger's own left edge, so it only ever grows
 *  rightward, away from the search input sitting to its left. */
function LocationPicker({
  locations,
  value,
  onChange,
}: {
  locations: LocationOption[];
  value: string;
  onChange: (slug: string) => void;
}) {
  const t = useTranslations("nav");
  const selectedLabel = value ? (locations.find((l) => l.slug === value)?.name ?? t("searchAnywhere")) : t("searchAnywhere");

  return (
    <Dropdown
      portal
      align="left"
      trigger={
        <>
          <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <span className="max-w-32 truncate">{selectedLabel}</span>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        </>
      }
      triggerClassName="relative inline-flex h-11 shrink-0 items-center rounded-lg border border-line bg-white py-0 pr-8 pl-9 text-sm text-ink transition-colors hover:border-muted"
      panelClassName="max-h-72 w-56 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-md"
    >
      {(close) => (
        <>
          <button
            type="button"
            onClick={() => {
              onChange("");
              close();
            }}
            className={value === "" ? "block w-full px-3 py-1.5 text-left text-sm font-medium text-pine" : "block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-paper"}
          >
            {t("searchAnywhere")}
          </button>
          {locations.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                onChange(l.slug);
                close();
              }}
              className={l.slug === value ? "block w-full px-3 py-1.5 text-left text-sm font-medium text-pine" : "block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-paper"}
            >
              {l.name}
            </button>
          ))}
        </>
      )}
    </Dropdown>
  );
}

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
    // Round-12 correction: rounds 5-7 grew every control here to h-14,
    // chasing a misread of the reference as wanting search to visibly
    // dominate the header. A pixel-measured comparison against the real
    // Design System Showcase shows the input, dropdown, and buttons
    // there all share one compact height — the same h-11 every other
    // `Button` in this app already uses. Reverted to that single shared
    // control height instead of a one-off larger size.
    <form onSubmit={handleSubmit} className="flex w-full min-w-0 items-center gap-2">
      {/* Real-usage follow-up, two rounds: first, doubling the
       *  placeholder's font-size alone left the box itself unchanged, so
       *  the bigger text just got clipped — `min-w-0` let this flex-1
       *  item shrink to whatever the row's other (shrink-0) controls
       *  left over, with nothing guaranteeing it stayed wide enough for
       *  its own content. A real min-width fixed that shrinking problem.
       *  Second correction: the doubled placeholder size itself was
       *  wrong once seen next to the row's other controls (location/
       *  radius/button all share the ordinary text-sm this input's own
       *  typed text already uses) — reverted the placeholder back to
       *  that same size, keeping only the wider box from the first fix. */}
      <div className="relative min-w-[300px] flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
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
          className="h-11 w-full min-w-[300px] rounded-lg border border-line bg-white pr-4 pl-9 text-sm placeholder:text-muted"
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
      <LocationPicker locations={locations} value={near} onChange={setNear} />
      {near && (
        <select
          value={radiusKm}
          onChange={(e) => setRadiusKm(e.target.value)}
          aria-label={t("searchRadiusLabel")}
          className="h-11 shrink-0 rounded-lg border border-line bg-white px-2 text-xs text-ink"
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r} km
            </option>
          ))}
        </select>
      )}
      <Button type="submit" className="shrink-0">
        {t("searchSubmit")}
      </Button>
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
        <Button
          variant="ghost"
          onClick={handleSave}
          disabled={!canSave || saveState === "saving"}
          title={saveState === "error" ? t("saveSearchError") : t("saveSearchHint")}
          className="shrink-0 px-2"
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
        </Button>
      )}
      {saveState === "error" && (
        <span className="shrink-0 text-xs text-red-700">{t("saveSearchError")}</span>
      )}
    </form>
  );
}
