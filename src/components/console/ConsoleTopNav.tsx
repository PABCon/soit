import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AccountMenu } from "@/components/console/AccountMenu";

/** The employer console's top bar (real-usage report: the console had no
 *  navbar at all — no avatar, no language switcher up top — mirroring the
 *  candidate site's own `TopNav` shape. `Sidebar` still owns the actual
 *  console nav links (My Job Ads/Company Profile/Team/etc.); this bar owns
 *  identity + locale, same split of responsibilities as the candidate side's
 *  TopNav+Rail. */
export async function ConsoleTopNav({
  fullName,
  avatarUrl,
  email,
}: {
  fullName: string | null;
  avatarUrl: string | null;
  email: string;
}) {
  const t = await getTranslations("console");
  const brand = await getTranslations("brand");

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link href="/recruit" className="shrink-0 leading-tight">
          <span className="block font-display text-lg font-bold text-pine">{brand("name")}</span>
          <span className="block text-[11px] text-muted">{t("title")}</span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <AccountMenu label={fullName || email} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
