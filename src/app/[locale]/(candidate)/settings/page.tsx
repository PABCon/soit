import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MarketingOptInToggle } from "@/components/candidate/MarketingOptInToggle";
import { DeleteAccountSection } from "@/components/candidate/DeleteAccountSection";
import { DataExportButton } from "@/components/candidate/DataExportButton";
import { getMyCandidateProfile } from "@/lib/db/candidate-profile";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rail" });
  return { title: t("settings"), robots: { index: false, follow: false } };
}

export default async function CandidateSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  const ts = await getTranslations({ locale, namespace: "settings" });
  const trail = await getTranslations({ locale, namespace: "rail" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/candidate/login", locale });

  const profile = await getMyCandidateProfile();

  return (
    <>
      <h1 className="text-2xl font-bold">{trail("settings")}</h1>

      <section className="mt-6">
        <h2 className="font-display text-sm font-semibold text-muted">{t("changePassword")}</h2>
        <div className="mt-2">
          <PasswordChangeForm />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-sm font-semibold text-muted">{ts("language")}</h2>
        <div className="mt-2">
          <LanguageSwitcher />
        </div>
      </section>

      {profile && (
        <section className="mt-10">
          <h2 className="font-display text-sm font-semibold text-muted">{ts("preferences")}</h2>
          <div className="mt-2">
            <MarketingOptInToggle initialOptIn={profile.marketingOptIn} />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-sm font-semibold text-muted">{ts("yourData")}</h2>
        <div className="mt-2">
          <DataExportButton />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-sm font-semibold text-muted">{ts("dangerZone")}</h2>
        <div className="mt-2">
          <DeleteAccountSection />
        </div>
      </section>
    </>
  );
}
