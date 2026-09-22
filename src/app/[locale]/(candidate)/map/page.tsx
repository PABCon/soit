import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { JobRow } from "@/components/JobRow";
import { getLiveJobs } from "@/lib/db/jobs";

const JobMap = dynamic(() =>
  import("@/components/JobMap").then((m) => m.JobMap),
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rail" });
  return { title: t("map") };
}

/** Split list + map (§7.1). Fully-remote jobs are listed beside the map with
 *  no pin — a remote job has no location and must not get a fake one (§8). */
export default async function MapPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "feed" });
  const tr = await getTranslations({ locale, namespace: "rail" });

  const jobs = await getLiveJobs();
  const pinned = jobs.filter((j) => j.lat !== null);
  const remote = jobs.filter((j) => j.lat === null);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{tr("map")}</h1>
        <Link
          href="/jobs"
          className="flex h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:border-muted"
        >
          {t("viewList")}
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="order-2 lg:order-1">
          <ul className="border-t border-line">
            {pinned.map((job) => (
              <JobRow key={job.slug} job={job} />
            ))}
          </ul>

          {remote.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-sm font-semibold text-muted">
                {t("remoteGroup")}
              </h2>
              <ul className="mt-2 border-t border-line">
                {remote.map((job) => (
                  <JobRow key={job.slug} job={job} />
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="order-1 h-[420px] overflow-hidden rounded-xl border border-line lg:sticky lg:top-20 lg:order-2 lg:h-[calc(100dvh-8rem)]">
          <JobMap jobs={pinned} />
        </div>
      </div>
    </>
  );
}
