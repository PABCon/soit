import type { Job } from "@/lib/types";
import { haversineKm } from "@/lib/geo";

/** Moved here from `useUrlSearchParams.ts` (a "use client" file) — this
 *  needs to be importable from plain server code too (the saved-search
 *  digest cron), and it was never actually React-dependent itself, just
 *  co-located with the hook that originally needed it. */
export function parseListParam(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  return raw ? raw.split(",").filter(Boolean) : [];
}

/** Every filter dimension `/jobs` actually supports (JobsExplorer.tsx) —
 *  extracted here so the saved-search digest cron can apply the exact
 *  same predicate instead of its own partial reimplementation. Real bug,
 *  found via a real-usage report: saved searches only ever captured
 *  `q`/`near`/`radiusKm` (the nav search bar's own fields) — a candidate
 *  filtering by salary + remote-only with no keyword typed couldn't save
 *  at all, and even a save that did go through would have silently
 *  ignored every other filter in the digest's own matching. */
export type JobFilterParams = {
  q: string;
  near: string;
  radiusKm: number;
  tech: string[];
  cat: string[];
  seniority: string[];
  adLanguage: string[];
  workModel: string[];
  employmentType: string[];
  reqLanguage: string[];
  remoteOnly: boolean;
  minSalary: number;
};

export function parseJobFilterParams(params: URLSearchParams): JobFilterParams {
  return {
    q: params.get("q") ?? "",
    near: params.get("near") ?? "",
    radiusKm: Number(params.get("radiusKm") ?? 0),
    tech: parseListParam(params, "tech"),
    cat: parseListParam(params, "cat"),
    seniority: parseListParam(params, "seniority"),
    adLanguage: parseListParam(params, "lang"),
    workModel: parseListParam(params, "workModel"),
    employmentType: parseListParam(params, "empType"),
    reqLanguage: parseListParam(params, "reqLang"),
    remoteOnly: params.get("remote") === "1",
    minSalary: Number(params.get("minSalary") ?? 0),
  };
}

/** A job's own `salaryMin`, normalized onto a monthly-gross scale so
 *  postings billed hourly/daily/yearly/monthly can all be compared
 *  against one `minSalary` floor. `null` (a hidden salary) is never
 *  excluded by the floor — there's nothing to compare. */
export function monthlyFloor(job: Pick<Job, "salaryMin" | "salaryPeriod">): number | null {
  if (job.salaryMin == null) return null;
  switch (job.salaryPeriod) {
    case "hour":
      return job.salaryMin * 8 * 21;
    case "day":
      return job.salaryMin * 21;
    case "year":
      return Math.round(job.salaryMin / 12);
    default:
      return job.salaryMin;
  }
}

type FilterableJob = Pick<
  Job,
  | "title"
  | "tech"
  | "categorySlug"
  | "seniority"
  | "language"
  | "workModel"
  | "employmentTypes"
  | "requiredLanguageSlugs"
  | "salaryMin"
  | "salaryPeriod"
  | "lat"
  | "lng"
>;

export function jobMatchesFilters(
  job: FilterableJob,
  filters: JobFilterParams,
  nearLocation: { latitude: number; longitude: number } | null,
): boolean {
  const query = filters.q.trim().toLowerCase();
  return (
    (filters.tech.length === 0 || filters.tech.some((x) => job.tech.includes(x))) &&
    (filters.cat.length === 0 || (job.categorySlug !== null && filters.cat.includes(job.categorySlug))) &&
    (filters.seniority.length === 0 || filters.seniority.includes(job.seniority)) &&
    (filters.adLanguage.length === 0 || filters.adLanguage.includes(job.language)) &&
    (filters.workModel.length === 0 || filters.workModel.includes(job.workModel)) &&
    (filters.employmentType.length === 0 || job.employmentTypes.some((et) => filters.employmentType.includes(et))) &&
    (filters.reqLanguage.length === 0 || filters.reqLanguage.some((l) => job.requiredLanguageSlugs.includes(l))) &&
    (!filters.remoteOnly || job.workModel === "remote") &&
    (monthlyFloor(job) === null || monthlyFloor(job)! >= filters.minSalary) &&
    (!query || job.title.toLowerCase().includes(query)) &&
    (!nearLocation ||
      filters.radiusKm <= 0 ||
      (job.lat !== null &&
        job.lng !== null &&
        haversineKm(nearLocation.latitude, nearLocation.longitude, job.lat, job.lng) <= filters.radiusKm))
  );
}
