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
  const ta = await getTranslations({ locale, namespace: "auth" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/employer/login", locale });

  const metadata = user.user_metadata as { full_name?: string; avatar_url?: string } | undefined;

  return (
    <>
      <h1 className="text-2xl font-bold">{t("myAccount")}</h1>

      <section className="mt-6">
        <h2 className="font-display text-sm font-semibold text-muted">{t("myProfile")}</h2>
        <div className="mt-2">
          <EmployerProfileForm initialFullName={metadata?.full_name ?? ""} avatarUrl={metadata?.avatar_url ?? null} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-sm font-semibold text-muted">{ta("changePassword")}</h2>
        <div className="mt-2">
          <PasswordChangeForm />
        </div>
      </section>
    </>
  );
}
