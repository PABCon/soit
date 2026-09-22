import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyApplications } from "@/lib/db/applications";
import { CompanyLogo } from "@/components/CompanyLogo";

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
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {applications.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {applications.map((app) => (
            <li key={app.id} className="flex items-center gap-4 py-4">
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
              <span className="shrink-0 rounded-md border border-line bg-white px-2 py-1 text-xs font-medium text-muted">
                {t(`status.${app.status}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
