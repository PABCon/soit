"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const MVP = [
  { key: "myJobAds", href: "/recruit" },
  { key: "applicants", href: "/recruit/applicants" },
  { key: "companyProfile", href: "/recruit/company" },
  { key: "team", href: "/recruit/team" },
  { key: "myAccount", href: "/recruit/settings" },
  { key: "contact", href: "/contact" },
] as const;

const LATER = ["matchmaking", "myProducts", "pricing"] as const;

/** Employer console sidebar (§7.2) — its own navigation, not the candidate
 *  rail. Identity (avatar) and locale live in `ConsoleTopNav` above this,
 *  not here — this is nav links only. */
export function Sidebar() {
  const t = useTranslations("console");

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-white/60 px-3 py-4 md:h-dvh md:w-60 md:border-r md:border-b-0">
      <nav className="flex gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
        {MVP.map(({ key, href }) => (
          <Link
            key={key}
            href={href}
            className="shrink-0 rounded-lg px-2 py-2 text-sm whitespace-nowrap text-ink hover:bg-paper"
          >
            {t(key)}
          </Link>
        ))}
        {LATER.map((key) => (
          <span
            key={key}
            title={`${t(key)} — ${t("soon")}`}
            aria-disabled="true"
            className="shrink-0 cursor-not-allowed rounded-lg px-2 py-2 text-sm whitespace-nowrap text-line"
          >
            {t(key)}
          </span>
        ))}
      </nav>
    </aside>
  );
}
