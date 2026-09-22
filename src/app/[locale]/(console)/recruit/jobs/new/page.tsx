import { getTranslations, setRequestLocale } from "next-intl/server";
import { getTechTags } from "@/lib/db/tech-tags";
import { JobForm } from "@/components/console/JobForm";

type Props = { params: Promise<{ locale: string }> };

export default async function NewJobPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });
  const techTags = await getTechTags();

  return (
    <>
      <h1 className="text-2xl font-bold">{t("addJobAd")}</h1>
      <div className="mt-6">
        <JobForm techTags={techTags} />
      </div>
    </>
  );
}
