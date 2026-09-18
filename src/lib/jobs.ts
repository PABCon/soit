import type { EmploymentType, SalaryPeriod } from "@/components/Salary";

export type Seniority = "junior" | "mid" | "senior" | "lead";
export type WorkModel = "remote" | "hybrid" | "office";

export type Company = {
  slug: string;
  name: string;
  /** Deterministic brand colour for the logo tile until real logos are uploaded. */
  color: string;
};

export type Job = {
  slug: string;
  title: string;
  company: Company;
  location: string | null;
  lat: number | null;
  lng: number | null;
  workModel: WorkModel;
  seniority: Seniority;
  tech: string[];
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: SalaryPeriod;
  salaryMonths?: number;
  employmentType: EmploymentType;
  language: "pt" | "en";
  postedDaysAgo: number;
};

const C = {
  marlin: { slug: "marlin-digital", name: "Marlin Digital", color: "#0C6B58" },
  azuria: { slug: "azuria-tech-hub", name: "Azuria Tech Hub", color: "#2D5BA8" },
  nortech: { slug: "nortech-solutions", name: "Nortech Solutions", color: "#8A3D5F" },
  tagus: { slug: "tagus-cloud", name: "Tagus Cloud", color: "#B4622A" },
  vela: { slug: "vela-systems", name: "Vela Systems", color: "#3F5E48" },
  beira: { slug: "beira-analytics", name: "Beira Analytics", color: "#5B4B8A" },
} satisfies Record<string, Company>;

const CITY = {
  lisboa: { location: "Lisboa", lat: 38.7223, lng: -9.1393 },
  porto: { location: "Porto", lat: 41.1579, lng: -8.6291 },
  braga: { location: "Braga", lat: 41.5454, lng: -8.4265 },
  aveiro: { location: "Aveiro", lat: 40.6405, lng: -8.6538 },
  coimbra: { location: "Coimbra", lat: 40.2033, lng: -8.4103 },
  remote: { location: null, lat: null, lng: null },
};

/**
 * Seed data for local development and design work. Companies are fictional —
 * attributing invented job ads to real employers would be fabricated content.
 * Salaries are monthly gross over 14 months, which is how Portugal quotes them.
 * Replaced by the database in build step 5.
 */
export const JOBS: Job[] = [
  {
    slug: "senior-java-developer-lisboa-a1f2",
    title: "Senior Java Developer",
    company: C.marlin, ...CITY.lisboa, workModel: "hybrid", seniority: "senior",
    tech: ["Java", "Spring Boot", "PostgreSQL", "AWS"],
    salaryMin: 3800, salaryMax: 4900, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "en", postedDaysAgo: 1,
  },
  {
    slug: "frontend-engineer-react-porto-b7c3",
    title: "Frontend Engineer",
    company: C.azuria, ...CITY.porto, workModel: "remote", seniority: "mid",
    tech: ["React", "TypeScript", "Next.js"],
    salaryMin: 2600, salaryMax: 3600, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "en", postedDaysAgo: 2,
  },
  {
    slug: "engenheiro-devops-lisboa-c9d1",
    title: "Engenheiro DevOps",
    company: C.tagus, ...CITY.lisboa, workModel: "hybrid", seniority: "senior",
    tech: ["Kubernetes", "Terraform", "AWS", "Go"],
    salaryMin: 3600, salaryMax: 4800, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "pt", postedDaysAgo: 3,
  },
  {
    slug: "data-engineer-braga-e4a8",
    title: "Data Engineer",
    company: C.nortech, ...CITY.braga, workModel: "office", seniority: "mid",
    tech: ["Python", "dbt", "Snowflake", "Airflow"],
    salaryMin: 2800, salaryMax: 3800, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "en", postedDaysAgo: 4,
  },
  {
    slug: "qa-automation-engineer-remote-f2b6",
    title: "QA Automation Engineer",
    company: C.vela, ...CITY.remote, workModel: "remote", seniority: "mid",
    tech: ["Playwright", "TypeScript", "CI/CD"],
    salaryMin: 2300, salaryMax: 3100, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "en", postedDaysAgo: 5,
  },
  {
    slug: "site-reliability-engineer-porto-a8e2",
    title: "Site Reliability Engineer",
    company: C.azuria, ...CITY.porto, workModel: "hybrid", seniority: "lead",
    tech: ["Kubernetes", "Prometheus", "Go", "Linux"],
    salaryMin: 4600, salaryMax: 6200, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "en", postedDaysAgo: 6,
  },
  {
    slug: "desenvolvedor-net-coimbra-d5f9",
    title: "Desenvolvedor .NET",
    company: C.beira, ...CITY.coimbra, workModel: "hybrid", seniority: "mid",
    tech: [".NET", "C#", "Azure", "SQL Server"],
    salaryMin: 2500, salaryMax: 3400, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "pt", postedDaysAgo: 7,
  },
  {
    slug: "junior-frontend-developer-aveiro-c1b4",
    title: "Junior Frontend Developer",
    company: C.nortech, ...CITY.aveiro, workModel: "office", seniority: "junior",
    tech: ["JavaScript", "React", "CSS"],
    salaryMin: 1400, salaryMax: 1900, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "pt", postedDaysAgo: 8,
  },
  {
    slug: "flutter-mobile-developer-remote-b3d7",
    title: "Flutter Mobile Developer",
    company: C.vela, ...CITY.remote, workModel: "remote", seniority: "senior",
    tech: ["Flutter", "Dart", "Firebase"],
    salaryMin: 340, salaryMax: 420, salaryPeriod: "day", salaryMonths: undefined,
    employmentType: "contractor", language: "en", postedDaysAgo: 9,
  },
  {
    slug: "python-backend-engineer-lisboa-e7c2",
    title: "Python Backend Engineer",
    company: C.marlin, ...CITY.lisboa, workModel: "remote", seniority: "senior",
    tech: ["Python", "Django", "PostgreSQL", "Docker"],
    salaryMin: 3400, salaryMax: 4400, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "en", postedDaysAgo: 11,
  },
  {
    slug: "engineering-manager-porto-f9a3",
    title: "Engineering Manager",
    company: C.azuria, ...CITY.porto, workModel: "hybrid", seniority: "lead",
    tech: ["Leadership", "Agile", "Java"],
    salaryMin: 5200, salaryMax: 6800, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "permanent", language: "en", postedDaysAgo: 13,
  },
  {
    slug: "salesforce-developer-lisboa-a2d8",
    title: "Salesforce Developer",
    company: C.tagus, ...CITY.lisboa, workModel: "hybrid", seniority: "mid",
    tech: ["Salesforce", "Apex", "LWC"],
    salaryMin: 3000, salaryMax: 4000, salaryPeriod: "month", salaryMonths: 14,
    employmentType: "fixed_term", language: "en", postedDaysAgo: 15,
  },
];

/** Ordered by how many jobs use each tag, so the filter bar leads with what
 *  the market actually asks for rather than with whatever sorts first. */
export const ALL_TECH = [...new Set(JOBS.flatMap((j) => j.tech))].sort((a, b) => {
  const count = (t: string) => JOBS.filter((j) => j.tech.includes(t)).length;
  return count(b) - count(a) || a.localeCompare(b);
});
export const SENIORITIES: Seniority[] = ["junior", "mid", "senior", "lead"];
export const WORK_MODELS: WorkModel[] = ["remote", "hybrid", "office"];

/** Monthly-equivalent floor, so a day rate and a monthly salary sort comparably. */
export function monthlyFloor(job: Job): number {
  switch (job.salaryPeriod) {
    case "hour": return job.salaryMin * 8 * 21;
    case "day": return job.salaryMin * 21;
    case "year": return Math.round(job.salaryMin / 12);
    default: return job.salaryMin;
  }
}
