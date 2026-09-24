import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

function PreviewHeader() {
  const brand = useTranslations("brand");
  const t = useTranslations("company");
  return (
    <header className="flex h-14 items-center gap-3 border-b border-line px-4">
      <span className="font-display text-lg font-bold text-pine">{brand("name")}</span>
      <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted">
        {t("previewBadge")}
      </span>
    </header>
  );
}

/** Opened from the employer console's "Ver perfil público" (§7.1) in a new
 *  tab — deliberately no Rail/TopNav/search/login menu, unlike every other
 *  route group. The whole point is a preview of what candidates see, not
 *  another way into the main site's job-browsing nav from a company
 *  session that has no reason to be there. */
export default async function PreviewLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <PreviewHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
