import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getJobForEdit } from "@/lib/db/jobs";
import { getTechTags } from "@/lib/db/tech-tags";
import { getLocations } from "@/lib/db/locations";
import { getJobCategories } from "@/lib/db/job-categories";
import { getSpokenLanguages } from "@/lib/db/spoken-languages";
import { getMyEmployerContext } from "@/lib/db/companies";
import { JobForm } from "@/components/console/JobForm";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function EditJobPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const [job, techTags, locations, jobCategories, spokenLanguages, ctx] = await Promise.all([
    getJobForEdit(id),
    getTechTags(),
    getLocations(),
    getJobCategories(),
    getSpokenLanguages(),
    getMyEmployerContext(),
  ]);
  if (!job) notFound();
  const isPayingCustomer = !!ctx && (ctx.company.ad_credits_available > 0 || ctx.company.top_employer_active);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("editJobAd")}</h1>
        <Link
          href={`/recruit/jobs/${job.id}/applicants`}
          className="text-sm font-medium text-pine hover:underline"
        >
          {t("viewApplicants")}
        </Link>
      </div>
      <div className="mt-6">
        <JobForm
          techTags={techTags}
          locations={locations}
          jobCategories={jobCategories}
          spokenLanguages={spokenLanguages}
          isPayingCustomer={isPayingCustomer}
          initial={{
            id: job.id,
            title: job.title,
            description: job.description,
            language: job.language,
            seniority: job.seniority,
            workModel: job.work_model,
            locationId: job.location_id,
            categoryId: job.category_id,
            salaryMin: job.salary_min,
            salaryMax: job.salary_max,
            salaryPeriod: job.salary_period,
            salaryMonths: job.salary_months,
            employmentType: job.employment_type,
            selectedTechTags: job.job_tech_tags.map((t) => ({
              id: t.tech_tag_id,
              level: t.level,
              required: t.required,
            })),
            selectedLanguages: job.job_languages.map((l) => ({ id: l.spoken_language_id, level: l.level })),
            externalApplyUrl: job.external_apply_url ?? "",
            expiresAt: job.expires_at ? job.expires_at.slice(0, 10) : null,
            salaryPublic: job.salary_public,
          }}
        />
      </div>
    </>
  );
}
