import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getApplicantDetail, updateApplicationStatus } from "@/lib/db/applications";
import { ApplicantStatusSelect } from "@/components/console/ApplicantStatusSelect";
import { ApplicantSynopsisSection } from "@/components/console/ApplicantSynopsisSection";

type Props = { params: Promise<{ locale: string; id: string }> };

/** Item 4 (§7.2 review): a real profile view for one applicant, reachable
 *  from both the per-job and the aggregated applicant lists. Opening it
 *  marks the application "viewed" automatically — but only advances the
 *  untouched `applied` state; an employer who already moved a candidate
 *  further along (responded/rejected/closed) never gets silently bumped
 *  back to "viewed" just by reopening the page.
 */
export default async function ApplicantDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "applicants" });
  const tp = await getTranslations({ locale, namespace: "profile" });

  const detail = await getApplicantDetail(id);
  if (!detail) notFound();

  let status = detail.status;
  if (status === "applied") {
    await updateApplicationStatus(detail.id, "viewed");
    status = "viewed";
  }

  const appliedOn = new Date(detail.createdAt).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB");

  return (
    <>
      <Link href="/recruit/applicants" className="text-sm font-medium text-pine hover:underline">
        {t("backToApplicants")}
      </Link>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {detail.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
            <img src={detail.avatarUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-pine font-display text-lg font-bold text-white">
              {detail.candidateName.slice(0, 1).toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">{detail.candidateName}</h1>
            <p className="mt-0.5 text-sm text-muted">
              <Link href={`/recruit/jobs/${detail.jobId}/applicants`} className="hover:text-pine hover:underline">
                {t("appliedFor", { job: detail.jobTitle })}
              </Link>
            </p>
            <p className="mt-0.5 text-xs text-muted">{appliedOn}</p>
          </div>
        </div>
        <ApplicantStatusSelect jobId={detail.jobId} applicationId={detail.id} initialStatus={status} />
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-6">
          <ApplicantSynopsisSection applicationId={detail.id} initialSynopsis={detail.aiSynopsis} />
          {detail.coverNote && (
            <section>
              <h2 className="font-display text-sm font-semibold text-muted">{t("coverNote")}</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink">{detail.coverNote}</p>
            </section>
          )}
          {detail.skills.length > 0 && (
            <section>
              <h2 className="font-display text-sm font-semibold text-muted">{tp("skills")}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 rounded-xl border border-line bg-white p-4">
          <div>
            <p className="text-xs font-medium text-muted uppercase">{tp("email")}</p>
            <p className="text-sm text-ink">{detail.candidateEmail}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted uppercase">{tp("phone")}</p>
            <p className="text-sm text-ink">{detail.phone || t("notProvided")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted uppercase">{tp("linkedinUrl")}</p>
            {detail.linkedinUrl ? (
              <a
                href={detail.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-pine hover:underline"
              >
                {detail.linkedinUrl}
              </a>
            ) : (
              <p className="text-sm text-ink">{t("notProvided")}</p>
            )}
          </div>
          {detail.cvSignedUrl ? (
            <a
              href={detail.cvSignedUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-sm font-medium text-pine hover:underline"
            >
              {t("viewCv")}
            </a>
          ) : (
            <p className="text-sm text-muted">{t("cvUnavailable")}</p>
          )}
        </aside>
      </div>
    </>
  );
}
