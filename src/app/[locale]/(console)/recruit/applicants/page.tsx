import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getAllApplicantsForCompany } from "@/lib/db/applications";
import { getOrCreateCompanyStages } from "@/lib/db/application-stages";
import { AllApplicantsList } from "@/components/console/AllApplicantsList";

type Props = { params: Promise<{ locale: string }> };

export default async function AllApplicantsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "applicants" });
  const tc = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{tc("notEmployer")}</p>;

  const [applicants, stages] = await Promise.all([
    getAllApplicantsForCompany(ctx.company.id),
    getOrCreateCompanyStages(ctx.company.id),
  ]);

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("allApplicantsTitle")}</h1>
      <AllApplicantsList applicants={applicants} stages={stages} locale={locale} />
    </>
  );
}
