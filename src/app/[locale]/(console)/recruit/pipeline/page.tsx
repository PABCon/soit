import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getOrCreateCompanyStages } from "@/lib/db/application-stages";
import { PipelineManager } from "@/components/console/PipelineManager";

type Props = { params: Promise<{ locale: string }> };

export default async function PipelinePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{t("notEmployer")}</p>;

  const stages = await getOrCreateCompanyStages(ctx.company.id);

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("pipeline")}</h1>
      <p className="mt-1 text-muted">{t("pipelineSubtitle")}</p>
      <div className="mt-6">
        <PipelineManager stages={stages} />
      </div>
    </>
  );
}
