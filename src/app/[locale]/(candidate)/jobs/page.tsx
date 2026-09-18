import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Salary } from "@/components/Salary";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "jobs" });
  return { title: t("title") };
}

export default async function JobsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <JobsFeed />;
}

/**
 * The job feed is the hero (§11): hairline-separated rows, not a grid of
 * shadowed cards. Real data arrives in build step 5; this is the shell plus
 * one sample row proving the salary component and the type scale.
 */
function JobsFeed() {
  const t = useTranslations("jobs");
  const brand = useTranslations("brand");

  return (
    <>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{brand("tagline")}</p>

      <ul className="mt-8 border-t border-line">
        <li className="flex items-center justify-between gap-6 border-b border-line py-4">
          <div className="min-w-0">
            <p className="font-display font-semibold">Senior Java Developer</p>
            <p className="mt-0.5 truncate text-sm text-muted">
              Sample Company — Lisboa · Hybrid
            </p>
          </div>
          <Salary
            min={4200}
            max={5600}
            period="month"
            months={14}
            employmentType="permanent"
          />
        </li>
      </ul>

      <p className="mt-8 text-sm text-muted">{t("empty")}</p>
    </>
  );
}
