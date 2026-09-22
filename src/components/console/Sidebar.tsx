"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";

const MVP = [
  { key: "myJobAds", href: "/recruit" },
  { key: "companyProfile", href: "/recruit/company" },
  { key: "team", href: "/recruit/team" },
] as const;

const LATER = ["matchmaking", "myProducts", "pricing", "contact"] as const;

/** Employer console sidebar (§7.2) — its own navigation, not the candidate rail. */
export function Sidebar() {
  const t = useTranslations("console");
  const brand = useTranslations("brand");
  const router = useRouter();

  async function handleLogOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-white/60 px-3 py-4 md:h-dvh md:w-60 md:border-r md:border-b-0">
      <Link href="/recruit" className="px-2 font-display text-lg font-bold text-pine">
        {brand("name")}
      </Link>
      <p className="mt-0.5 px-2 text-xs text-muted">{t("title")}</p>

      <nav className="mt-4 flex gap-0.5 overflow-x-auto md:mt-6 md:flex-col md:overflow-visible">
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

      <div className="mt-4 flex items-center justify-between px-2 md:mt-auto md:pt-4">
        <Link href="/jobs" className="text-xs text-muted hover:text-ink">
          {t("backToSite")}
        </Link>
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleLogOut} className="text-xs text-muted hover:text-ink">
            {t("logOut")}
          </button>
          <LanguageSwitcher />
        </div>
      </div>
    </aside>
  );
}
