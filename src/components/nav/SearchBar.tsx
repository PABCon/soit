"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useUrlSearchParams, writeUrlSearchParams } from "@/hooks/useUrlSearchParams";
import { saveSearchAction } from "@/app/[locale]/(candidate)/saved-searches/actions";
import type { LocationOption } from "@/lib/db/locations";

const RADIUS_OPTIONS = [10, 25, 50, 100];

/** Global search (§7.1 phase 5) — title keyword + "near a curated city
 *  within N km" (Haversine over the already-fetched job list in
 *  JobsExplorer, no geocoding provider — see its own comment). Lives in
 *  TopNav so it's reachable from anywhere, not just /jobs: submitting from
 *  elsewhere does a real navigation to /jobs (correct — a genuinely new
 *  page); submitting while already on /jobs updates the URL in place via
 *  the same instant, no-round-trip mechanism JobsExplorer's own filters
 *  use, preserving whatever chip filters are already active there. */
export function SearchBar({ locations }: { locations: LocationOption[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const urlParams = useUrlSearchParams();
  const onJobsPage = pathname === "/jobs";

  const [q, setQ] = useState(() => (onJobsPage ? (urlParams.get("q") ?? "") : ""));
  const [near, setNear] = useState(() => (onJobsPage ? (urlParams.get("near") ?? "") : ""));
  const [radiusKm, setRadiusKm] = useState(() => (onJobsPage ? (urlParams.get("radiusKm") ?? "25") : "25"));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const canSave = q.trim() !== "" || near !== "";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const patch = new URLSearchParams();
    if (q.trim()) patch.set("q", q.trim());
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
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search")}
        className="h-9 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-sm placeholder:text-muted"
      />
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
      )}
      <button
        type="submit"
        className="h-9 shrink-0 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90"
      >
        {t("searchSubmit")}
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave || saveState === "saving"}
        title={saveState === "error" ? t("saveSearchError") : t("saveSearch")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-pine disabled:opacity-40"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={saveState === "saved" ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4h12v16l-6-4-6 4V4Z" />
        </svg>
        <span className="sr-only">{t("saveSearch")}</span>
      </button>
      {saveState === "error" && (
        <span className="shrink-0 text-xs text-red-700">{t("saveSearchError")}</span>
      )}
    </form>
  );
}
