import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCandidateProfile, getMyCvSignedUrl } from "@/lib/db/candidate-profile";
import { CandidateProfileForm } from "@/components/candidate/CandidateProfileForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rail" });
  return { title: t("profile"), robots: { index: false, follow: false } };
}

export default async function CandidateProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "profile" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/candidate/login", locale });

  const profile = await getMyCandidateProfile();
  if (!profile) return redirect({ href: "/candidate/login", locale });

  const cvSignedUrl = await getMyCvSignedUrl();

  return (
    <>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="mt-6">
        <CandidateProfileForm profile={profile} cvSignedUrl={cvSignedUrl} />
      </div>
    </>
  );
}
