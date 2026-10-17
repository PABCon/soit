import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyApplications } from "@/lib/db/applications";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Badge } from "@/components/Badge";
import { APPLICANT_STATUS_BADGE } from "@/lib/applicant-status-badge";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rail" });
  return { title: t("applications"), robots: { index: false, follow: false } };
}

export default async function ApplicationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "applications" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/candidate/login", locale });

  const applications = await getMyApplications();

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("title")}</h1>
      <p className="mt-1 text-muted">{t("subtitle")}</p>

      {applications.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {applications.map((app) => (
            <li
              key={app.id}
              className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 transition-colors hover:border-pine"
            >
              <CompanyLogo company={app.job.company} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/jobs/${app.job.slug}`}
                  className="font-medium text-ink hover:text-pine hover:underline"
                >
                  {app.job.title}
                </Link>
                <p className="mt-0.5 text-sm text-muted">{app.job.company.name}</p>
              </div>
              <Badge variant={APPLICANT_STATUS_BADGE[app.status]} className="shrink-0">
                {t(`status.${app.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
