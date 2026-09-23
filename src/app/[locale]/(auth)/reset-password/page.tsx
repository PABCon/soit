import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("resetPasswordTitle"), robots: { index: false, follow: false } };
}

/** Landed on from a recovery-link click, after /auth/callback has already
 *  exchanged the code for a real session (see that route's `type=recovery`
 *  branch) — so this page can call supabase.auth.updateUser() directly. */
export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-ink">{t("resetPasswordTitle")}</h1>
      <ResetPasswordForm />
    </>
  );
}
