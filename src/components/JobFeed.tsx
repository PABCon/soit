"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { JobRow } from "@/components/JobRow";
import {
  JOBS,
  ALL_TECH,
  SENIORITIES,
  WORK_MODELS,
  monthlyFloor,
  type Job,
} from "@/lib/jobs";

type Filters = {
  tech: string[];
  seniority: string[];
  workModel: string[];
  minSalary: number;
};

const EMPTY: Filters = { tech: [], seniority: [], workModel: [], minSalary: 0 };

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * The job feed with live filtering (§7.1). Runs over seed data today; step 5
 * swaps the source for the database and moves filtering server-side so the
 * results stay crawlable.
 */
export function JobFeed() {
  const t = useTranslations("feed");
  const [f, setF] = useState<Filters>(EMPTY);

  const jobs = useMemo(
    () =>
      JOBS.filter(
        (j: Job) =>
          (f.tech.length === 0 || f.tech.some((x) => j.tech.includes(x))) &&
          (f.seniority.length === 0 || f.seniority.includes(j.seniority)) &&
          (f.workModel.length === 0 || f.workModel.includes(j.workModel)) &&
          monthlyFloor(j) >= f.minSalary,
      ).sort((a, b) => a.postedDaysAgo - b.postedDaysAgo),
    [f],
  );

  const active =
    f.tech.length + f.seniority.length + f.workModel.length + (f.minSalary ? 1 : 0);

  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
      on
        ? "border-pine bg-pine text-white"
        : "border-line bg-white text-muted hover:border-muted hover:text-ink"
    }`;

  return (
    <>
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {WORK_MODELS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setF({ ...f, workModel: toggle(f.workModel, w) })}
              className={chip(f.workModel.includes(w))}
            >
              {t(`workModel.${w}`)}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          {SENIORITIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setF({ ...f, seniority: toggle(f.seniority, s) })}
              className={chip(f.seniority.includes(s))}
            >
              {t(`seniority.${s}`)}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {ALL_TECH.slice(0, 14).map((tech) => (
            <button
              key={tech}
              type="button"
              onClick={() => setF({ ...f, tech: toggle(f.tech, tech) })}
              className={chip(f.tech.includes(tech))}
            >
              {tech}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <label className="flex items-center gap-2 text-xs text-muted">
            {t("minSalary")}
            <input
              type="range"
              min={0}
              max={6000}
              step={250}
              value={f.minSalary}
              onChange={(e) => setF({ ...f, minSalary: Number(e.target.value) })}
              className="h-1 w-40 accent-pine"
            />
            <span className="w-20 font-semibold text-ink tabular-nums">
              {f.minSalary ? `€${f.minSalary.toLocaleString("pt-PT")}` : t("any")}
            </span>
          </label>

          <p className="ml-auto text-xs text-muted">
            {t("results", { count: jobs.length })}
          </p>
          {active > 0 && (
            <button
              type="button"
              onClick={() => setF(EMPTY)}
              className="text-xs font-medium text-pine underline underline-offset-2"
            >
              {t("clear")}
            </button>
          )}
        </div>
      </div>

      {jobs.length > 0 ? (
        <ul className="mt-4 border-t border-line">
          {jobs.map((job) => (
            <JobRow key={job.slug} job={job} />
          ))}
        </ul>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-line py-16 text-center">
          <p className="text-sm text-muted">{t("noMatches")}</p>
          <button
            type="button"
            onClick={() => setF(EMPTY)}
            className="mt-3 text-sm font-medium text-pine underline underline-offset-2"
          >
            {t("clear")}
          </button>
        </div>
      )}
    </>
  );
}
