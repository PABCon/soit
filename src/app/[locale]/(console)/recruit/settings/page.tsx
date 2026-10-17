import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmployerProfileForm } from "@/components/console/EmployerProfileForm";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "console" });
  return { title: t("myAccount"), robots: { index: false, follow: false } };
}

export default async function EmployerSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/employer/login", locale });

  const metadata = user.user_metadata as { full_name?: string; phone?: string; avatar_url?: string } | undefined;

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("myAccount")}</h1>
      <p className="mt-1 text-muted">{t("myAccountSubtitle")}</p>

      <div className="mt-6 space-y-6">
        <EmployerProfileForm
          initialFullName={metadata?.full_name ?? ""}
          initialPhone={metadata?.phone ?? ""}
          email={user.email ?? ""}
          avatarUrl={metadata?.avatar_url ?? null}
        />
        <PasswordChangeForm variant="card" />
      </div>
    </>
  );
}
