"use client";

import { useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useUrlSearchParams, writeUrlSearchParams } from "@/hooks/useUrlSearchParams";

/** Real-usage report: the full `SearchBar` (keyword + near-me location +
 *  radius + autocomplete + save) is `hidden sm:block` in `TopNav` for a
 *  real reason, not an oversight — its own keyword input alone has a
 *  `min-w-[300px]`, and alongside the location/radius/save controls the
 *  whole thing simply can't fit next to the logo and language/login group
 *  on a narrow phone screen. But that left mobile with no text search at
 *  all, a real functional gap, not just a cosmetic one. This is a
 *  deliberately smaller, keyword-only fallback: a toggle button in the
 *  header that drops down a full-width input below it, no location
 *  picker, no autocomplete — "search by text" is the actual ask, not
 *  full parity with the desktop control. Submitting merges into the
 *  current `/jobs` URL (same instant, no-round-trip mechanism the chip
 *  filters use) when already there, or navigates to `/jobs?q=...`
 *  otherwise, same two-branch logic `SearchBar` itself already uses. */
export function MobileSearchBar() {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const onJobsPage = pathname === "/jobs";
  const urlParams = useUrlSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(() => (onJobsPage ? (urlParams.get("q") ?? "") : ""));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (onJobsPage) {
      const merged = new URLSearchParams(urlParams.toString());
      if (trimmed) merged.set("q", trimmed);
      else merged.delete("q");
      writeUrlSearchParams(merged);
    } else {
      router.push(trimmed ? `/jobs?q=${encodeURIComponent(trimmed)}` : "/jobs");
    }
    setOpen(false);
  }

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("search")}
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center text-ink"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-line bg-paper px-4 py-3 shadow-sm">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              {/* 16px, not text-sm (14px): below this size, iOS Safari
               *  auto-zooms the whole page on focus — the exact bug this
               *  project already fixed once for every other mobile input
               *  (see globals.css's own unlayered font-size floor), kept
               *  explicit here too since a brand-new input is the kind of
               *  thing that's easy to introduce the same regression in. */}
              <input
                autoFocus
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("search")}
                className="h-11 w-full min-w-0 rounded-lg border border-line bg-white py-0 pr-3 pl-9 text-base placeholder:text-muted"
              />
            </div>
            <button
              type="submit"
              className="h-11 shrink-0 rounded-lg bg-pine px-4 text-sm font-semibold text-white hover:bg-pine-hover"
            >
              {t("searchSubmit")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
