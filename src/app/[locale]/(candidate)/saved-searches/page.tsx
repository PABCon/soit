import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Search } from "lucide-react";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMySavedSearches, savedSearchHref } from "@/lib/db/saved-searches";
import { Link } from "@/i18n/navigation";
import { DeleteSavedSearchButton } from "@/components/DeleteSavedSearchButton";
import { SavedSearchNotifyToggle } from "@/components/SavedSearchNotifyToggle";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "savedSearches" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Saved searches (§7.1, real-usage QA round 3 phase 5) — save/manage
 *  only, no email delivery yet (no real sender or scheduled-job infra
 *  exists in this project; see CLAUDE.md). Same shell as /applications
 *  and /favorites. */
export default async function SavedSearchesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "savedSearches" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/candidate/login", locale });

  const searches = await getMySavedSearches();

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("title")}</h1>
      <p className="mt-1 text-muted">{t("subtitle")}</p>

      {searches.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {searches.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 transition-colors hover:border-pine"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle">
                <Search className="h-4 w-4 text-pine" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={savedSearchHref(s.query)}
                  className="font-medium text-ink hover:text-pine hover:underline"
                >
                  {s.label}
                </Link>
              </div>
              <SavedSearchNotifyToggle id={s.id} initialOptIn={s.notifyOptIn} />
              <DeleteSavedSearchButton id={s.id} label={t("delete")} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
