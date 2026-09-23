import type { EmploymentType, SalaryPeriod } from "@/components/Salary";

export type Seniority = "junior" | "mid" | "senior" | "lead";
export type WorkModel = "remote" | "hybrid" | "office";

export type Company = {
  slug: string;
  name: string;
  logoUrl?: string | null;
};

export type Job = {
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
};
