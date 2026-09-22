import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobFeed } from "@/components/JobFeed";
import { Link } from "@/i18n/navigation";
import { getLiveJobs } from "@/lib/db/jobs";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "jobs" });
  return { title: t("title") };
}

export default async function JobsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "jobs" });
  const tf = await getTranslations({ locale, namespace: "feed" });
  const brand = await getTranslations({ locale, namespace: "brand" });
  const jobs = await getLiveJobs();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{brand("tagline")}</p>
        </div>
        <Link
          href="/map"
          className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:border-muted"
        >
          {tf("viewMap")}
        </Link>
      </div>

      <div className="mt-6">
        <JobFeed jobs={jobs} />
      </div>
    </>
  );
}
