"use client";

import { useTranslations } from "next-intl";
import { Modal } from "@/components/Modal";
import { Salary, type SalaryPeriod, type EmploymentType } from "@/components/Salary";
import { TechStackDetail } from "@/components/TechStackDetail";
import { JobDescriptionBody } from "@/components/JobDescriptionBody";
import type { SkillLevel } from "@/lib/types";

type PreviewTechStackEntry = { id: string; label: string; level: SkillLevel | null; required: boolean };
type PreviewLanguageEntry = { id: string; label: string; level: SkillLevel | null };

/** "Preview of how the job will look" (real-usage ask). Deliberately a
 *  simplified, standalone render — same precedent as
 *  `CompanyProfilePreview` — not the real job detail page's own component
 *  tree/data-fetching, since this has to work from `JobForm`'s live,
 *  unsaved, in-memory state (a draft may have no id, no slug, no saved
 *  row at all) rather than a real fetched `JobDetail`. Reuses the same
 *  presentational pieces the real page does (`Salary`, `TechStackDetail`,
 *  `JobDescriptionBody`) so the preview doesn't silently drift from what
 *  candidates will actually see. */
export function JobPreviewModal({
  onClose,
  title,
  description,
  companyName,
  companyLogoUrl,
  workModel,
  seniority,
  language,
  employmentTypes,
  locationName,
  salaryMin,
  salaryMax,
  salaryPeriod,
  salaryMonths,
  salaryPublic,
  techStack,
  requiredLanguages,
}: {
  onClose: () => void;
  title: string;
  description: string;
  companyName: string;
  companyLogoUrl: string | null;
  workModel: "remote" | "hybrid" | "office";
  seniority: "junior" | "mid" | "senior" | "lead";
  language: "pt" | "en";
  employmentTypes: EmploymentType[];
  locationName: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod;
  salaryMonths: number | null;
  salaryPublic: boolean;
  techStack: PreviewTechStackEntry[];
  requiredLanguages: PreviewLanguageEntry[];
}) {
  const t = useTranslations("jobForm");

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-2xl">
      <p className="mb-4 rounded-lg bg-pine/10 px-3 py-2 text-xs font-medium text-pine">{t("previewNotice")}</p>

      <div className="rounded-xl border border-line bg-white p-5">
        <div className="flex items-start gap-4">
          {companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- live unsaved preview, not an optimizable static asset
            <img src={companyLogoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-line object-contain" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-paper text-lg font-semibold text-muted">
              {companyName.slice(0, 1).toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-ink">{title.trim() || t("previewUntitled")}</h2>
            <p className="mt-1 text-sm text-muted">
              {companyName} · {locationName ?? t("locationRemote")}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[t(`workModelOption.${workModel}`), t(`seniorityOption.${seniority}`), language.toUpperCase()].map((b) => (
            <span key={b} className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-muted">
              {b}
            </span>
          ))}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <Salary
            min={salaryPublic ? salaryMin : null}
            max={salaryPublic ? salaryMax : null}
            period={salaryPeriod}
            months={salaryMonths ?? undefined}
            employmentType={employmentTypes[0] ?? "permanent"}
            size="detail"
          />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-display text-sm font-semibold tracking-wide text-muted">{t("description")}</h3>
        <div className="mt-2">
          {description.trim() ? (
            <JobDescriptionBody description={description} />
          ) : (
            <p className="text-sm text-muted italic">{t("previewNoDescription")}</p>
          )}
        </div>
      </div>

      {techStack.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-sm font-semibold tracking-wide text-muted">{t("techTags")}</h3>
          <div className="mt-2">
            <TechStackDetail
              techStack={techStack.map((entry) => ({
                slug: entry.id,
                label: entry.label,
                level: entry.level,
                required: entry.required,
              }))}
            />
          </div>
        </div>
      )}

      {requiredLanguages.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-sm font-semibold tracking-wide text-muted">{t("requiredLanguages")}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {requiredLanguages.map((lang) => (
              <span key={lang.id} className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-muted">
                {lang.label}
                {lang.level ? ` — ${t(`levelOption.${lang.level}`)}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
