"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useClickOutside } from "@/hooks/useClickOutside";

type Item = { key: string; href: string; icon: React.ReactNode; mvp: boolean; highlight?: boolean };

const icon = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const ITEMS: Item[] = [
  {
    key: "recommendations",
    href: "/recommendations",
    icon: icon("M12 2 14.5 9H22l-6 4.5L18 22l-6-4.5L6 22l2-8.5L2 9h7.5Z"),
    mvp: true,
    highlight: true,
  },
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
    highlight: true,
  },
  { key: "favorites", href: "/favorites", icon: icon("m12 20-7-7a4 4 0 0 1 7-5 4 4 0 0 1 7 5Z"), mvp: true },
  { key: "profile", href: "/profile", icon: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0"), mvp: true },
  { key: "cv", href: "#", icon: icon("M7 3h7l5 5v13H7Zm7 0v5h5"), mvp: false },
  { key: "settings", href: "/settings", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3-2-1 1-2-2-2-2 1-1-2h-4l-1 2-2-1-2 2 1 2-2 1v4l2 1-1 2 2 2 2-1 1 2h4l1-2 2 1 2-2-1-2 2-1Z"), mvp: true },
];

/** Left nav (§7.1) — a real-usage report asked for it to stay minimized by
 *  default always, opening a compact flyout on click rather than a
 *  permanent full-height sidebar, so the content column always has full
 *  width. Purely a floating trigger + ephemeral popover now: no more
 *  localStorage-persisted collapse state (that was for a layout-affecting
 *  sidebar; a momentary popover doesn't need to remember anything across
 *  page loads — it always starts closed). Closes on outside click/Escape
 *  via the shared useClickOutside hook, and on picking an item. */
export function Rail({ unreadMessageCount = 0 }: { unreadMessageCount?: number }) {
  const t = useTranslations("rail");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="fixed top-1/2 left-0 z-20 hidden -translate-y-1/2 sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={open ? t("collapse") : t("expand")}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-r-lg border border-l-0 border-line bg-white px-1.5 py-3 text-muted shadow-sm transition-colors hover:text-pine"
      >
        <span className="text-xs font-medium tracking-wide" style={{ writingMode: "vertical-rl" }}>
          <span className="inline-block rotate-180">{open ? t("collapse") : t("expand")}</span>
        </span>
      </button>

      {open && (
        <nav
          aria-label={t("offers")}
          className="absolute top-1/2 left-full ml-2 flex min-w-[190px] -translate-y-1/2 flex-col gap-0.5 rounded-xl border border-line bg-white p-1.5 shadow-lg"
        >
          {ITEMS.map((item) => {
            if (!item.mvp) {
              return (
                <span
                  key={item.key}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-line"
                >
                  {item.icon}
                  <span className="text-sm font-medium">
                    {t(item.key)} <span className="text-xs">— {t("soon")}</span>
                  </span>
                </span>
              );
            }

            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  item.highlight
                    ? "bg-pine text-white shadow-sm hover:bg-pine/90"
                    : active
                      ? "bg-pine/10 text-pine"
                      : "text-muted hover:bg-paper hover:text-pine"
                }`}
              >
                {item.icon}
                <span className="flex flex-1 items-center justify-between gap-2 text-sm font-medium whitespace-nowrap">
                  {t(item.key)}
                  {item.key === "communication" && unreadMessageCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pine px-1 text-[11px] font-semibold text-white">
                      {unreadMessageCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
