import type { Job } from "@/lib/types";
import { jobMatchesFilters, type JobFilterParams } from "@/lib/jobs/match-filters";

const SENIORITY_VALUES = ["junior", "mid", "senior", "lead"];
const WORK_MODEL_VALUES = ["remote", "hybrid", "office"];
const EMPLOYMENT_TYPE_VALUES = ["permanent", "fixed_term", "contractor", "freelance", "internship"];
const DEFAULT_RADIUS_KM = 25; // Same default SearchBar.tsx's own radius picker starts on.
const MAX_RESULTS = 6;

/** The chat assistant's one search tool, kept as a plain function so the
 *  matching logic itself is unit-testable without spinning up the AI SDK
 *  at all. The model is given the real vocabulary (tech labels, category/
 *  location/language slugs) in its system prompt and asked to map
 *  natural language onto it directly: this function is the defensive
 *  re-validation layer, never trusting the model's output as-is: any
 *  value that doesn't match something real is silently dropped, never
 *  invented or passed through, the same "never invent" discipline every
 *  other extraction feature in this codebase already follows. */
export type SearchJobsArgs = {
  q?: string;
  tech?: string[];
  categorySlug?: string;
  seniority?: string[];
  workModel?: string[];
  employmentType?: string[];
  reqLanguageSlug?: string[];
  remoteOnly?: boolean;
  minSalary?: number;
  locationSlug?: string;
  radiusKm?: number;
};

export type SearchJobsVocab = {
  /** Deliberately not the full `TechTagOption` from `@/lib/db/tech-tags`:
   *  importing that module pulls in its own email-sending import chain
   *  (`resolveTechTagLabel`'s dependency on `sendEmail`), which has
   *  nothing to do with matching and makes this module untestable in
   *  isolation without live email credentials. This file stays
   *  dependency-free on purpose; the caller (the route) fetches the
   *  real vocabulary and passes just the shape needed here. */
  tech: { label: string; aliases: string[] }[];
  categorySlugs: string[];
  languageSlugs: string[];
  locations: { slug: string; latitude: number; longitude: number }[];
};

export type SearchJobsResult = {
  count: number;
  jobs: Job[];
};

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/** Same exact/alias matching as `findMatchingTechTag` in
 *  `@/lib/db/tech-tags`, reimplemented here to avoid that module's import
 *  chain (see `SearchJobsVocab.tech`'s own comment). Keep both in sync if
 *  the matching rule itself ever changes. */
function findMatchingTech(label: string, vocab: { label: string; aliases: string[] }[]): string | null {
  const norm = normalizeLabel(label);
  const match = vocab.find((t) => normalizeLabel(t.label) === norm || t.aliases.some((a) => normalizeLabel(a) === norm));
  return match?.label ?? null;
}

export function searchJobs(allJobs: Job[], args: SearchJobsArgs, vocab: SearchJobsVocab): SearchJobsResult {
  const tech = (args.tech ?? [])
    .map((label) => findMatchingTech(label, vocab.tech))
    .filter((l): l is string => l != null);

  const cat = args.categorySlug && vocab.categorySlugs.includes(args.categorySlug) ? [args.categorySlug] : [];
  const reqLanguage = (args.reqLanguageSlug ?? []).filter((slug) => vocab.languageSlugs.includes(slug));

  const location = args.locationSlug ? (vocab.locations.find((l) => l.slug === args.locationSlug) ?? null) : null;

  const filters: JobFilterParams = {
    q: args.q ?? "",
    near: location?.slug ?? "",
    radiusKm: location ? (args.radiusKm ?? DEFAULT_RADIUS_KM) : 0,
    tech,
    cat,
    seniority: (args.seniority ?? []).filter((s) => SENIORITY_VALUES.includes(s)),
    adLanguage: [],
    workModel: (args.workModel ?? []).filter((w) => WORK_MODEL_VALUES.includes(w)),
    employmentType: (args.employmentType ?? []).filter((e) => EMPLOYMENT_TYPE_VALUES.includes(e)),
    reqLanguage,
    remoteOnly: args.remoteOnly ?? false,
    minSalary: args.minSalary ?? 0,
  };

  const nearLocation = location ? { latitude: location.latitude, longitude: location.longitude } : null;
  const matches = allJobs.filter((job) => jobMatchesFilters(job, filters, nearLocation));

  return { count: matches.length, jobs: matches.slice(0, MAX_RESULTS) };
}
