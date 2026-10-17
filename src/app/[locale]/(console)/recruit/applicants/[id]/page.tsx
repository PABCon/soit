import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale, getFormatter } from "next-intl/server";
import { ListChecks, Briefcase, Award, FileText as CvIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getApplicantDetail, updateApplicationStatus } from "@/lib/db/applications";
import { ApplicantStatusSelect } from "@/components/console/ApplicantStatusSelect";
import { ApplicantSynopsisSection } from "@/components/console/ApplicantSynopsisSection";
import { SectionHeading } from "@/components/SectionHeading";
import { Badge } from "@/components/Badge";
import { APPLICANT_STATUS_BADGE } from "@/lib/applicant-status-badge";

type Props = { params: Promise<{ locale: string; id: string }> };

/** Item 4 (§7.2 review): a real profile view for one applicant, reachable
 *  from both the per-job and the aggregated applicant lists. Opening it
 *  marks the application "viewed" automatically — but only advances the
 *  untouched `applied` state; an employer who already moved a candidate
 *  further along (responded/rejected/closed) never gets silently bumped
 *  back to "viewed" just by reopening the page.
 *
 *  Round 36: restructured to match the matchmaking candidate profile
 *  page's layout (per the user's own words, "the application individual
 *  candidates should look very close, there is just no need to hide
 *  information") — same icon-circle section headings, same two-card
 *  sidebar split (Contact information / CV / Résumé), same shared
 *  `AiSummaryPanel`. Unlike that blinded page, every field here is real:
 *  the candidate's actual name, a status badge reflecting their real
 *  pipeline status, real email/phone/LinkedIn, and a genuinely working
 *  "View CV" link — there's no anonymity to protect for a real applicant,
 *  so none of the matchmaking page's blinding logic belongs here. */
export default async function ApplicantDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "applicants" });
  const tp = await getTranslations({ locale, namespace: "profile" });
  const tc = await getTranslations({ locale, namespace: "console" });
  const tse = await getTranslations({ locale, namespace: "skillsEducation" });
  const format = await getFormatter({ locale });

  function formatMonthYear(dateStr: string): string {
    return format.dateTime(new Date(dateStr), { year: "numeric", month: "short" });
  }

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

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {detail.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
            <img src={detail.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pine font-display text-lg font-bold text-white">
              {detail.candidateName.slice(0, 1).toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold">{detail.candidateName}</h1>
              <Badge variant={APPLICANT_STATUS_BADGE[status]}>{t(`status.${status}`)}</Badge>
            </div>
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
              <SectionHeading icon={ListChecks}>{tc("skills")}</SectionHeading>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}
          <section>
            <SectionHeading icon={Briefcase}>{tc("experienceSectionHeading")}</SectionHeading>
            {detail.yearsExperience != null && (
              <p className="mt-2 text-sm text-ink">{tc("yearsExperience", { count: detail.yearsExperience })}</p>
            )}
            {detail.experience.length > 0 ? (
              <ol className="mt-3 space-y-4 border-l border-line pl-4">
                {detail.experience.map((entry) => (
                  <li key={entry.id}>
                    <p className="font-medium text-ink">{entry.title}</p>
                    <p className="text-sm text-muted">
                      {entry.company}
                      {entry.location ? ` · ${entry.location}` : ""}
                    </p>
                    {entry.startDate && (
                      <p className="text-xs text-muted">
                        {formatMonthYear(entry.startDate)} – {entry.endDate ? formatMonthYear(entry.endDate) : t("present")}
                      </p>
                    )}
                    {entry.description && <p className="mt-1 text-sm text-ink">{entry.description}</p>}
                    {entry.highlights.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {entry.highlights.map((highlight, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-sm text-ink">
                            <span aria-hidden className="text-muted">
                              •
                            </span>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              detail.yearsExperience == null && <p className="mt-2 text-sm text-muted">{tc("yearsExperienceUnknown")}</p>
            )}
          </section>

          {detail.certifications.length > 0 && (
            <section>
              <SectionHeading icon={Award}>{tse("certifications")}</SectionHeading>
              <ul className="mt-2 space-y-2">
                {detail.certifications.map((cert) => (
                  <li key={cert.id}>
                    <p className="text-sm font-medium text-ink">{cert.name}</p>
                    <p className="text-xs text-muted">
                      {[cert.issuer, cert.issuedDate ? formatMonthYear(cert.issuedDate) : null].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <aside className="space-y-4 rounded-xl border border-line bg-white p-4">
            <h2 className="font-display text-sm font-semibold text-ink">{tc("contactInfoHeading")}</h2>
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
          </aside>

          <aside className="space-y-2 rounded-xl border border-line bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle">
                <CvIcon className="h-3.5 w-3.5 text-pine" aria-hidden="true" />
              </span>
              <h2 className="font-display text-sm font-semibold text-ink">{tc("cvHeading")}</h2>
            </div>
            {detail.cvSignedUrl ? (
              <>
                <p className="text-sm text-ink">{t("cvAvailable")}</p>
                <a
                  href={detail.cvSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm font-medium text-pine hover:underline"
                >
                  {t("viewCv")}
                </a>
              </>
            ) : (
              <p className="text-sm text-muted">{t("cvUnavailable")}</p>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
