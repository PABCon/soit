import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

function AuthHeader() {
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

/** Auth entry points (§9.2) get a minimal shell — no Rail, no Sidebar. */
export default async function AuthLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <AuthHeader />
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
