import { useTranslations } from "next-intl";
import type { JobTechStackEntry } from "@/lib/db/jobs";

const LEVEL_RANK = { basic: 1, intermediate: 2, advanced: 3, expert: 4 } as const;

/** Job detail page's richer tech-stack display (real-usage QA item) — a
 *  level dial + must-have/nice-to-have distinction, versus the plain
 *  label chips `TechTags` shows everywhere space is tight (feed rows,
 *  company profile). Server component: no interactivity, just a render of
 *  data the job-detail page already has. */
export function TechStackDetail({ techStack }: { techStack: JobTechStackEntry[] }) {
  const t = useTranslations("jobForm");

  return (
    <ul className="flex flex-wrap gap-2">
      {techStack.map((entry) => (
        <li
          key={entry.slug}
          className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs"
        >
          <span className="font-medium text-ink">{entry.label}</span>
          {entry.level && (
            <span className="flex items-center gap-0.5" title={t(`levelOption.${entry.level}`)}>
              {[1, 2, 3, 4].map((dot) => (
                <span
                  key={dot}
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    dot <= LEVEL_RANK[entry.level!] ? "bg-pine" : "bg-line"
                  }`}
                />
              ))}
              <span className="sr-only">{t(`levelOption.${entry.level}`)}</span>
            </span>
          )}
          {entry.required ? (
            <span className="rounded bg-pine/10 px-1 py-0.5 text-[10px] font-semibold tracking-wide text-pine uppercase">
              {t("mustHave")}
            </span>
          ) : (
            <span className="text-[10px] text-muted">{t("niceToHave")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
