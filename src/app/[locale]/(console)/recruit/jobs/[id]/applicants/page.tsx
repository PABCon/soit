import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getJobForEdit } from "@/lib/db/jobs";
import { getApplicantsForJob } from "@/lib/db/applications";
import { ApplicantsList } from "@/components/console/ApplicantsList";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function ApplicantsPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "applicants" });

  const [job, applicants] = await Promise.all([getJobForEdit(id), getApplicantsForJob(id)]);
  if (!job) notFound();

  return (
    <>
      <h1 className="text-2xl font-bold">{t("title", { job: job.title })}</h1>
      <ApplicantsList jobId={id} applicants={applicants} />
    </>
  );
}
