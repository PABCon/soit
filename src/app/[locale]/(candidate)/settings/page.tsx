import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Globe, Bell, Download, AlertTriangle } from "lucide-react";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MarketingOptInToggle } from "@/components/candidate/MarketingOptInToggle";
import { DeleteAccountSection } from "@/components/candidate/DeleteAccountSection";
import { DataExportButton } from "@/components/candidate/DataExportButton";
import { CardHeading } from "@/components/CardHeading";
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
      <h1 className="text-3xl font-bold lg:text-4xl">{trail("settings")}</h1>
      <p className="mt-1 text-muted">{ts("subtitle")}</p>

      <div className="mt-6 max-w-2xl space-y-6">
        <PasswordChangeForm variant="card" />

        <div className="rounded-xl border border-line bg-white p-6">
          <CardHeading icon={Globe} title={ts("language")} subtitle={ts("languageSubtitle")} />
          <div className="mt-5">
            <LanguageSwitcher />
          </div>
        </div>

        {profile && (
          <div className="rounded-xl border border-line bg-white p-6">
            <CardHeading icon={Bell} title={ts("preferences")} subtitle={ts("preferencesSubtitle")} />
            <div className="mt-5">
              <MarketingOptInToggle initialOptIn={profile.marketingOptIn} />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-line bg-white p-6">
          <CardHeading icon={Download} title={ts("yourData")} />
          <div className="mt-5">
            <DataExportButton />
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-white p-6">
          <CardHeading icon={AlertTriangle} title={ts("dangerZone")} tone="danger" />
          <div className="mt-5">
            <DeleteAccountSection />
          </div>
        </div>
      </div>
    </>
  );
}
