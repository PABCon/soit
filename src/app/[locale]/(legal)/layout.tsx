import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Footer } from "@/components/Footer";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

function LegalHeader() {
  const brand = useTranslations("brand");
  return (
    <header className="flex h-14 items-center gap-4 border-b border-line px-4">
      <Link href="/jobs" className="font-display text-lg font-bold text-pine">
        {brand("name")}
      </Link>
      <div className="ml-auto">
        <LanguageSwitcher />
      </div>
    </header>
  );
}

/** Legal pages (privacy/terms) are universally accessible — unlike
 *  (candidate), this layout must never gate on role, since an employer
 *  session needs to be able to read these too. Minimal shell, same pattern
 *  as (auth)'s AuthHeader. */
export default async function LegalLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <LegalHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
      <Footer />
    </div>
  );
}
