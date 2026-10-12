import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Footer } from "@/components/Footer";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

function AuthHeader() {
  const brand = useTranslations("brand");
  return (
    <header className="flex h-14 items-center gap-4 border-b border-line px-4">
      <Link href="/jobs" className="leading-tight">
        {/* eslint-disable-next-line @next/next/no-img-element -- small local brand asset, not a remote/optimizable photo */}
        <img src="/logo-justit.png" alt={brand("name")} className="h-6 w-auto" />
      </Link>
      <div className="ml-auto">
        <LanguageSwitcher />
      </div>
    </header>
  );
}

/** Auth entry points (§9.2) get a minimal shell — no Rail, no Sidebar.
 *  No width constraint here (round 21): the four role×mode login/register
 *  pages render a full-bleed two-column split-screen via
 *  `AuthSplitScreen`; the other auth pages (forgot/reset-password,
 *  accept-invite) each wrap their own content in the same `max-w-sm`
 *  column this layout used to apply globally, so their appearance is
 *  unchanged. */
export default async function AuthLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <AuthHeader />
      <main className="flex w-full flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
