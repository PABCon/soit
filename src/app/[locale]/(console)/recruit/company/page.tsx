import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMyEmployerContext } from "@/lib/db/companies";
import { CompanyProfileForm } from "@/components/console/CompanyProfileForm";

type Props = { params: Promise<{ locale: string }> };

export default async function CompanyProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{t("notEmployer")}</p>;

  return (
    <>
      <h1 className="text-2xl font-bold">{t("companyProfile")}</h1>
      <div className="mt-6">
        <CompanyProfileForm company={ctx.company} canEdit={ctx.role === "owner"} />
      </div>
    </>
  );
}
