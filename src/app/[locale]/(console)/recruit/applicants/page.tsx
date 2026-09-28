import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getAllApplicantsForCompany } from "@/lib/db/applications";
import { AllApplicantsList } from "@/components/console/AllApplicantsList";

type Props = { params: Promise<{ locale: string }> };

export default async function AllApplicantsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "applicants" });
  const tc = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{tc("notEmployer")}</p>;

  const applicants = await getAllApplicantsForCompany(ctx.company.id);

  return (
    <>
      <h1 className="text-2xl font-bold">{t("allApplicantsTitle")}</h1>
      <AllApplicantsList applicants={applicants} />
    </>
  );
}
