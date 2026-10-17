import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginMenu } from "@/components/nav/LoginMenu";
import { SearchBar, type SearchSuggestion } from "@/components/nav/SearchBar";
import { getLocations } from "@/lib/db/locations";
import { getTechTags } from "@/lib/db/tech-tags";
import { getJobCategories } from "@/lib/db/job-categories";

/**
 * Public top nav (§7.3): role-split Log in dropdown + a real, centered
 * search (§7.1 phase 5) + language switcher. "Add offer" lives inside
 * LoginMenu — it only makes sense logged-out, and that's the one place
 * that already knows auth state. LoginMenu/SearchBar are the only
 * client-side pieces; this stays a server component so it can fetch the
 * curated locations list SearchBar's "near" picker needs.
 */
export async function TopNav() {
  const locale = await getLocale();
  const brand = await getTranslations({ locale, namespace: "brand" });
  const [locations, techTags, categories] = await Promise.all([
    getLocations(),
    getTechTags(),
    getJobCategories(),
  ]);
  const suggestions: SearchSuggestion[] = [
    ...techTags.map((t) => ({ label: t.label, kind: "tech" as const })),
    ...categories.map((c) => ({ label: c.label, kind: "category" as const })),
  ];

  return (
    // z-30, not z-10: real-usage report — a job card's favorite heart
    // (absolute, z-10, deeper in the DOM) painted over this header's own
    // open dropdown. Both were z-10, a tie at the root stacking level
    // broken by DOM order in favor of the later (page-content) element —
    // the dropdown's own higher z-index only wins contests *within* this
    // header's stacking context, not against something outside it. A
    // sticky header should always outrank floating page content, not just
    // match it.
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      {/* h-16 (64px) — round-12 correction: rounds 5-7 progressively grew
       *  this to h-20 with h-14 controls, chasing a misread of the
       *  reference as wanting search to be "the dominant element." A
       *  pixel-measured comparison against the actual Design System
       *  Showcase header shows every control there (input, dropdown,
       *  buttons) shares one compact height — the same `h-11` `Button`
       *  already uses everywhere else in this app — inside a modest
       *  header, not a deliberately oversized one. `grid-cols-[1fr_auto_
       *  1fr]` still makes the search bar genuinely centered regardless
       *  of how wide the logo or the right-side group happen to be. */}
      <div className="mx-auto grid h-16 w-full max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <Link href="/jobs" className="justify-self-start leading-tight">
          {/* eslint-disable-next-line @next/next/no-img-element -- small local brand asset, not a remote/optimizable photo */}
          <img src="/logo-justit.png" alt={brand("name")} className="h-7 w-auto" />
          {/* Hidden below sm: a real, measured mobile overflow bug — this
           *  single-line, un-wrapped tagline forced the whole logo block to
           *  ~200px wide (its own natural text width), which combined with
           *  the nav's own shrink-0 button group overflowed a 390px
           *  viewport by ~90px. Purely decorative subtitle, not
           *  functional — hiding it at the one breakpoint where it doesn't
           *  fit is a real fix, not a content removal. */}
          <span className="mt-0.5 hidden text-[11px] text-muted sm:block">{brand("navTagline")}</span>
        </Link>

        {/* max-w-4xl, not max-w-2xl: real-usage follow-up — widening the
         *  keyword input (below) to fit its own doubled-size placeholder
         *  pushed the row's total natural width to ~790px, past the old
         *  672px cap, so the trailing controls visually overflowed into
         *  this column's neighbors instead of actually growing the row.
         *  Widening this wrapper is what lets the centered-grid layout
         *  absorb that extra width correctly, as intended. */}
        <div className="hidden w-full max-w-4xl min-w-0 justify-self-center sm:block">
          <SearchBar locations={locations} suggestions={suggestions} />
        </div>

        <div className="flex shrink-0 items-center justify-self-end gap-2">
          <LanguageSwitcher />
          <LoginMenu />
        </div>
      </div>
    </header>
  );
}
