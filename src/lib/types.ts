import type { EmploymentType, SalaryPeriod } from "@/components/Salary";

export type Seniority = "junior" | "mid" | "senior" | "lead";
export type WorkModel = "remote" | "hybrid" | "office";
/** Proficiency level for a required tech tag or working language (§ real-
 *  usage QA, employer-console review, item 10b/11) — feeds the future
 *  candidate-scoring engine, not scored against anything yet itself. */
export type SkillLevel = "basic" | "intermediate" | "advanced" | "expert";

export type Company = {
  slug: string;
  name: string;
  logoUrl?: string | null;
};

export type Job = {
  id: string;
  slug: string;
  title: string;
  company: Company;
  location: string | null;
  locationSlug: string | null;
  lat: number | null;
  lng: number | null;
  workModel: WorkModel;
  seniority: Seniority;
  tech: string[];
  categorySlug: string | null;
  /** Spoken/working languages the job requires (slugs) — filters-redesign
   *  QA item. Distinct from `language` below, which is just the ad's own
   *  PT/EN text language. */
  requiredLanguageSlugs: string[];
  /** null when the employer has chosen to hide the salary from the public
   *  listing (a paid-tier-only choice, §pricing) — still collected/stored,
   *  just not sent to the client. Never null for a free-tier job. */
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod;
  salaryMonths?: number;
  /** The "primary" type — the first one the employer picked, still a
   *  single value for every consumer that only ever needs one (the
   *  public API's existing field, JSON-LD's single-value fallback,
   *  sort/default display). */
  employmentType: EmploymentType;
  /** The full set this job accepts (real-usage QA item: "multiple
   *  contract types on one job ad") — always includes `employmentType`
   *  itself. Length 1 for the common case of a job with only one. */
  employmentTypes: EmploymentType[];
  language: "pt" | "en";
  postedDaysAgo: number;
  /** null for a draft/never-published job — "days left" has no meaning yet. */
  daysLeft: number | null;
  /** §pricing — badge + feed-ranking fact, deliberately public. */
  isTopEmployer: boolean;
  /** §pricing bump mechanic — true for 72h after a manual bump or the
   *  auto-boost, then reverts to false on its own (no separate expiry job). */
  isBoosted: boolean;
};
