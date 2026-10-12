import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileText, Bookmark, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthSplitScreen } from "@/components/auth/AuthSplitScreen";
import { AuthHero } from "@/components/auth/AuthHero";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("candidateLoginTitle"), robots: { index: false, follow: false } };
}

export default async function CandidateLoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  const h = await getTranslations({ locale, namespace: "auth.candidateLoginHero" });

  return (
    <AuthSplitScreen
      hero={
        <AuthHero
          headlinePrefix={h("headlinePrefix")}
          headlineEmphasis={h("headlineEmphasis")}
          subtitle={h("subtitle")}
          bullets={[
            { Icon: FileText, title: h("bullet1Title"), desc: h("bullet1Desc") },
            { Icon: Bookmark, title: h("bullet2Title"), desc: h("bullet2Desc") },
            { Icon: User, title: h("bullet3Title"), desc: h("bullet3Desc") },
          ]}
        />
      }
    >
      <h2 className="mb-6 text-2xl font-bold text-ink">{t("candidateLoginTitle")}</h2>
      <Suspense>
        <AuthForm role="candidate" mode="login" />
      </Suspense>
      <p className="mt-6 text-sm text-muted">
        {t("needAccount")}{" "}
        <Link href="/candidate/register" className="font-medium text-pine hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </AuthSplitScreen>
  );
}
