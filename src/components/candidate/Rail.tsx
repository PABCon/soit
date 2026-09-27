"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Item = { key: string; href: string; icon: React.ReactNode; mvp: boolean };

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
  { key: "offers", href: "/jobs", icon: icon("M4 7h16M4 12h16M4 17h10"), mvp: true },
  { key: "map", href: "/map", icon: icon("M9 4 3 7v13l6-3 6 3 6-3V4l-6 3-6-3Zm0 0v13m6-10v13"), mvp: true },
  { key: "applications", href: "/applications", icon: icon("M9 5h6m-7 4h8m-8 4h8m-8 4h5M5 3h14v18H5Z"), mvp: true },
  { key: "companies", href: "/companies", icon: icon("M3 21h18M5 21V7l7-4 7 4v14M9 10h2m2 0h2m-6 4h2m2 0h2"), mvp: true },
  { key: "favorites", href: "#", icon: icon("m12 20-7-7a4 4 0 0 1 7-5 4 4 0 0 1 7 5Z"), mvp: false },
  { key: "profile", href: "/profile", icon: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0"), mvp: true },
  { key: "cv", href: "#", icon: icon("M7 3h7l5 5v13H7Zm7 0v5h5"), mvp: false },
  { key: "settings", href: "/settings", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3-2-1 1-2-2-2-2 1-1-2h-4l-1 2-2-1-2 2 1 2-2 1v4l2 1-1 2 2 2 2-1 1 2h4l1-2 2 1 2-2-1-2 2-1Z"), mvp: true },
];

const COLLAPSE_KEY = "soit:rail-collapsed";
const COLLAPSE_EVENT = "soit:rail-collapsed-change";

// useSyncExternalStore instead of useState+useEffect: reading localStorage
// during an effect and then setState-ing it is exactly the "cascading
// render" pattern react-hooks/set-state-in-effect flags, and it causes a
// visible flash besides. This renders `false` for SSR/first hydration pass
// (no mismatch) and picks up the real value immediately after; localStorage
// writes never fire `storage` in the same tab that made them, hence the
// custom event alongside it for same-tab reactivity.
function subscribe(callback: () => void) {
  window.addEventListener(COLLAPSE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function getSnapshot() {
  return localStorage.getItem(COLLAPSE_KEY) === "1";
}
function getServerSnapshot() {
  return false;
}

/** Persistent left icon rail (§7.1). Later items are drawn but disabled
 *  (§13). Collapsible (real-usage report: shouldn't be permanently fixed) —
 *  a per-viewer display preference in localStorage, not account data; the
 *  collapsed state is a thin single-button strip, everything else in the
 *  layout reflows on its own since this is a plain flex sibling. */
export function Rail() {
  const t = useTranslations("rail");
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }

  if (collapsed) {
    return (
      <nav className="sticky top-0 hidden h-dvh w-12 shrink-0 flex-col items-center border-r border-line bg-white/50 py-4 sm:flex">
        <button
          type="button"
          onClick={toggle}
          title={t("expand")}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-pine"
        >
          {icon("m9 6 6 6-6 6")}
          <span className="sr-only">{t("expand")}</span>
        </button>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("offers")}
      className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col items-center gap-1 border-r border-line bg-white/50 py-4 sm:flex"
    >
      {ITEMS.map((item) =>
        item.mvp ? (
          <Link
            key={item.key}
            href={item.href}
            title={t(item.key)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-pine"
          >
            {item.icon}
            <span className="sr-only">{t(item.key)}</span>
          </Link>
        ) : (
          <span
            key={item.key}
            title={`${t(item.key)} — ${t("soon")}`}
            aria-disabled="true"
            className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-lg text-line"
          >
            {item.icon}
            <span className="sr-only">{`${t(item.key)} — ${t("soon")}`}</span>
          </span>
        ),
      )}
      <button
        type="button"
        onClick={toggle}
        title={t("collapse")}
        className="mt-auto flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-pine"
      >
        {icon("m15 6-6 6 6 6")}
        <span className="sr-only">{t("collapse")}</span>
      </button>
    </nav>
  );
}
