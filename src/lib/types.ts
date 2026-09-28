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
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: SalaryPeriod;
  salaryMonths?: number;
  employmentType: EmploymentType;
  language: "pt" | "en";
  postedDaysAgo: number;
  /** null for a draft/never-published job — "days left" has no meaning yet. */
  daysLeft: number | null;
};
