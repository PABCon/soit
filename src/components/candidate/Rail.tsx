"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

type Item = { key: string; href: string; icon: React.ReactNode; mvp: boolean };

const icon = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const ITEMS: Item[] = [
  { key: "recommendations", href: "/recommendations", icon: icon("M12 2 14.5 9H22l-6 4.5L18 22l-6-4.5L6 22l2-8.5L2 9h7.5Z"), mvp: true },
  { key: "offers", href: "/jobs", icon: icon("M4 7h16M4 12h16M4 17h10"), mvp: true },
  { key: "applications", href: "/applications", icon: icon("M9 5h6m-7 4h8m-8 4h8m-8 4h5M5 3h14v18H5Z"), mvp: true },
  {
    key: "communication",
    href: "/messages",
    icon: icon("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"),
    mvp: true,
  },
  { key: "companies", href: "/companies", icon: icon("M3 21h18M5 21V7l7-4 7 4v14M9 10h2m2 0h2m-6 4h2m2 0h2"), mvp: true },
  {
    key: "salaryCalculator",
    href: "/salario-liquido",
    icon: icon("M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"),
    mvp: true,
  },
  { key: "favorites", href: "/favorites", icon: icon("m12 20-7-7a4 4 0 0 1 7-5 4 4 0 0 1 7 5Z"), mvp: true },
  { key: "profile", href: "/profile", icon: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0"), mvp: true },
  { key: "cv", href: "#", icon: icon("M7 3h7l5 5v13H7Zm7 0v5h5"), mvp: false },
  { key: "settings", href: "/settings", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3-2-1 1-2-2-2-2 1-1-2h-4l-1 2-2-1-2 2 1 2-2 1v4l2 1-1 2 2 2 2-1 1 2h4l1-2 2 1 2-2-1-2 2-1Z"), mvp: true },
];

/**
 * Left nav — round 7: two direct corrections to round 6's own version.
 *
 * 1. **Pure hover, no manual control at all.** The chevron toggle button
 *    (and its `pinned`/click-outside state) is gone entirely, per explicit
 *    instruction — desktop interaction is now hover-in-to-expand/
 *    hover-out-to-collapse only, nothing else. Real a11y note, not
 *    silently swallowed: this removes the only non-hover way to reach the
 *    expanded (labeled) state, which matters for anyone who can't hover
 *    (keyboard-only, some touch/assistive-tech setups) — every route
 *    behind an icon is still reachable via its `title` tooltip and the
 *    icon itself, just without the text label ever becoming visible for
 *    them. Flagging it rather than quietly keeping a control that was
 *    just asked to be removed.
 * 2. **Vertically centered below the header, not full-height top-aligned.**
 *    Round 6's full-height top-aligned look (matching the justjoin.it
 *    reference literally) is reverted — back to vertically centered, but
 *    now constrained to the viewport area *below* the header rather than
 *    the full viewport, so it can never visually sit beside/overlap the
 *    navbar row the way a `top-0`-anchored full-height strip could read.
 *    `sticky top-20` (the header's own `h-20`) plus
 *    `h-[calc(100dvh-5rem)]` + `justify-center` together guarantee the
 *    nav's own box starts exactly at the header's bottom edge — sticky
 *    positioning clamps it there even at scroll position 0, not just
 *    while scrolling — and its contents center within that reduced
 *    height, not the full viewport.
 *
 * The reserved-gutter mechanism itself (a real flex sibling in
 * `(candidate)/layout.tsx`, zero overlap with content by construction)
 * is unchanged from rounds 5/6 — this round only touches this component's
 * own vertical position/sizing and its interaction model.
 */
export function Rail({ unreadMessageCount = 0 }: { unreadMessageCount?: number }) {
  const t = useTranslations("rail");
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);

  function isActive(item: Item) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  function renderItem(item: Item) {
    if (!item.mvp) {
      return (
        <span
          key={item.key}
          aria-disabled="true"
          title={hovered ? undefined : `${t(item.key)} — ${t("soon")}`}
          className="flex cursor-not-allowed items-center gap-3 rounded-lg p-3 text-line"
        >
          {item.icon}
          {hovered && (
            <span className="text-sm font-medium whitespace-nowrap">
              {t(item.key)} <span className="text-xs">— {t("soon")}</span>
            </span>
          )}
        </span>
      );
    }

    const active = isActive(item);
    return (
      <Link
        key={item.key}
        href={item.href}
        title={hovered ? undefined : t(item.key)}
        // Round-10 full-fidelity sweep: the reference's own "Floating Side
        // Menu" swatch — never specifically audited before (round 7's own
        // Components-panel audit covered buttons/chips/badges/tags, not
        // this panel) — shows the active item as a *pale* pine-tinted
        // highlight with pine-colored text/icon, plus a thin left accent
        // bar, not a solid-pine fill with white text.
        className={`relative flex items-center gap-3 rounded-lg p-3 transition-colors ${
          active ? "bg-pine/10 text-pine" : "text-muted hover:bg-paper hover:text-pine"
        }`}
      >
        {active && hovered && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -left-2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-pine"
          />
        )}
        {item.icon}
        {item.key === "communication" && unreadMessageCount > 0 && !hovered && !active && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pine px-0.5 text-[10px] font-semibold text-white">
            {unreadMessageCount}
          </span>
        )}
        {hovered && (
          <span className="flex flex-1 items-center justify-between gap-2 text-[13px] font-medium whitespace-nowrap">
            {t(item.key)}
            {item.key === "communication" && unreadMessageCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pine px-1 text-[11px] font-semibold text-white">
                {unreadMessageCount}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  }

  return (
    // Reserved gutter — a real flex sibling (see (candidate)/layout.tsx),
    // not an overlay. The nav inside it can grow wider than this w-16
    // parent on hover; since the parent has no overflow-hidden, that
    // growth simply overlays page content rather than reflowing it.
    <div className="hidden shrink-0 sm:block sm:w-16">
      {/* Round-11: round-7 dropped the white background entirely per
       *  feedback that it "didn't add anything" — but with real job-card
       *  content now scrolling behind it, the icons/labels became hard to
       *  read. Brought a background back, but soft and content-sized: it
       *  lives on the actual icon/label stack (which hugs its own content
       *  height), not on this outer sticky wrapper, which stays fully
       *  transparent and only exists to center that stack vertically in
       *  the viewport area below the header. */}
      <div className="sticky top-20 z-20 flex h-[calc(100dvh-5rem)] w-16 flex-col justify-center">
        <nav
          aria-label={t("offers")}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`flex max-h-full flex-col items-stretch gap-2 overflow-y-auto overflow-x-hidden rounded-2xl bg-white/70 py-6 shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-[width] duration-150 ${
            hovered ? "w-56 px-3" : "w-16 px-2"
          }`}
        >
          {ITEMS.map((item) => renderItem(item))}
        </nav>
      </div>
    </div>
  );
}
