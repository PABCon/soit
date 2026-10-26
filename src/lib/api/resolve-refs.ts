import { z } from "zod";
import { getJobCategories } from "@/lib/db/job-categories";
import { getLocations } from "@/lib/db/locations";
import { getTechTags } from "@/lib/db/tech-tags";
import { getSpokenLanguages } from "@/lib/db/spoken-languages";
import type { JobFormInput, JobTechTagInput, JobLanguageInput, TypeSalaryInput } from "@/lib/db/jobs";
import type { EmploymentType } from "@/components/Salary";

const skillLevel = z.enum(["basic", "intermediate", "advanced", "expert"]);
const salaryBasis = z.enum(["gross", "net"]);
const employmentType = z.enum(["permanent", "fixed_term", "contractor", "freelance", "internship"]);

// A distinct salary for one *additional* accepted contract type (§pricing /
// "two contract types, two amounts" finding) — same shape and rules as the
// job's own top-level salary fields, just scoped to one `typeSalaries` entry.
const typeSalarySchema = z
  .object({
    salaryMin: z.number().positive(),
    salaryMax: z.number().positive(),
    salaryPeriod: z.enum(["hour", "day", "month", "year"]),
    salaryMonths: z.number().int().min(12).max(14).nullable().optional(),
    salaryBasis: salaryBasis.optional(),
  })
  .refine((v) => v.salaryMax >= v.salaryMin, { message: "salaryMax must be >= salaryMin", path: ["salaryMax"] })
  .refine((v) => v.salaryPeriod === "month" || v.salaryMonths == null, {
    message: "salaryMonths only applies when salaryPeriod is \"month\"",
    path: ["salaryMonths"],
  });

const techTagSchema = z.object({
  slug: z.string().min(1),
  level: skillLevel.nullable().optional(),
  required: z.boolean().optional().default(false),
});

const languageSchema = z.object({
  slug: z.string().min(1),
  level: skillLevel.nullable().optional(),
});

// Mirrors `JobForm.tsx`'s own required/optional split (§ plan research)
// so an external caller faces the same rules the console form already
// enforces — this is the untrusted boundary `saveJob` itself doesn't
// re-validate, trusting its TS-typed caller instead.
const jobBodySchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    language: z.enum(["pt", "en"]),
    seniority: z.enum(["junior", "mid", "senior", "lead"]),
    workModel: z.enum(["remote", "hybrid", "office"]),
    categorySlug: z.string().min(1),
    locationSlug: z.string().min(1).nullable().optional(),
    salaryMin: z.number().positive(),
    salaryMax: z.number().positive(),
    salaryPeriod: z.enum(["hour", "day", "month", "year"]),
    salaryMonths: z.number().int().min(12).max(14).nullable().optional(),
    // The primary type's own salary basis (gross/net, §pricing) — defaults
    // to "gross" in `saveJob` itself when omitted, matching the console
    // form's own default.
    salaryBasis: salaryBasis.optional(),
    // `employmentType` (singular) kept for backward compatibility with
    // existing integrations built before multiple contract types per job
    // existed; `employmentTypes` (plural) is the new, preferred field.
    // Exactly one of the two must be given — see the refine() below.
    employmentType: employmentType.optional(),
    employmentTypes: z.array(employmentType).min(1).optional(),
    // A distinct salary range for an *additional* accepted contract type
    // beyond the primary one (§pricing finding: a posting can genuinely
    // quote, e.g., a gross B2B day-rate alongside a net permanent-contract
    // salary for the same role) — keyed by employment type. An entry for
    // the primary type is accepted but ignored, same as the console form:
    // the primary's range always comes from this body's own top-level
    // salary fields above.
    // Keyed by plain `z.string()`, not the `employmentType` enum — `z.record`
    // with an enum key schema models an *exhaustive* Record<K, V> (every
    // enum key required), not a partial map; validity of each key as a real
    // employment type (and as one of this job's own accepted types) is
    // checked explicitly below instead.
    typeSalaries: z.record(z.string(), typeSalarySchema).optional(),
    techTags: z.array(techTagSchema).optional().default([]),
    languages: z.array(languageSchema).optional().default([]),
    externalApplyUrl: z.string().trim().optional().default(""),
    expiresAt: z.string().nullable().optional(),
    publish: z.boolean().optional().default(false),
    salaryPublic: z.boolean().optional().default(true),
  })
  .refine((v) => v.salaryMax >= v.salaryMin, { message: "salaryMax must be >= salaryMin", path: ["salaryMax"] })
  .refine((v) => v.workModel === "remote" || !!v.locationSlug, {
    message: "locationSlug is required unless workModel is \"remote\"",
    path: ["locationSlug"],
  })
  .refine((v) => v.salaryPeriod === "month" || v.salaryMonths == null, {
    message: "salaryMonths only applies when salaryPeriod is \"month\"",
    path: ["salaryMonths"],
  })
  .refine((v) => !!v.employmentType || !!v.employmentTypes, {
    message: "Either employmentType or employmentTypes is required",
    path: ["employmentTypes"],
  })
  .refine(
    (v) => {
      if (!v.typeSalaries) return true;
      const accepted = new Set(v.employmentTypes ?? (v.employmentType ? [v.employmentType] : []));
      return Object.keys(v.typeSalaries).every((t) => accepted.has(t as EmploymentType));
    },
    {
      message: "typeSalaries can only key on a type listed in employmentType/employmentTypes",
      path: ["typeSalaries"],
    },
  );

export type ResolveJobRefsResult =
  | { ok: true; input: JobFormInput }
  | { ok: false; status: number; error: string; message: string };

/** Turns the API's human-readable slugs into the UUIDs `JobFormInput`
 *  expects — an external integrator shouldn't have to know this
 *  product's internal ids, only the slugs `GET /api/v1/reference`
 *  hands them. */
export async function resolveJobRefs(body: unknown): Promise<ResolveJobRefsResult> {
  const parsed = jobBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: issue ? `${issue.path.join(".") || "(body)"}: ${issue.message}` : "Invalid request body",
    };
  }
  const v = parsed.data;

  const [categories, locations, techTags, languages] = await Promise.all([
    getJobCategories(),
    getLocations(),
    getTechTags(),
    getSpokenLanguages(),
  ]);

  const category = categories.find((c) => c.slug === v.categorySlug);
  if (!category) {
    return { ok: false, status: 400, error: "unknown_category_slug", message: `Unknown categorySlug "${v.categorySlug}"` };
  }

  let locationId: string | null = null;
  if (v.workModel !== "remote") {
    const location = locations.find((l) => l.slug === v.locationSlug);
    if (!location) {
      return { ok: false, status: 400, error: "unknown_location_slug", message: `Unknown locationSlug "${v.locationSlug}"` };
    }
    locationId = location.id;
  }

  const resolvedTechTags: JobTechTagInput[] = [];
  for (const tag of v.techTags) {
    const match = techTags.find((t) => t.slug === tag.slug);
    if (!match) {
      return { ok: false, status: 400, error: "unknown_tech_tag_slug", message: `Unknown tech tag slug "${tag.slug}"` };
    }
    resolvedTechTags.push({ techTagId: match.id, level: tag.level ?? null, required: tag.required });
  }

  const resolvedLanguages: JobLanguageInput[] = [];
  for (const lang of v.languages) {
    const match = languages.find((l) => l.slug === lang.slug);
    if (!match) {
      return { ok: false, status: 400, error: "unknown_language_slug", message: `Unknown language slug "${lang.slug}"` };
    }
    resolvedLanguages.push({ spokenLanguageId: match.id, level: lang.level ?? null });
  }

  let typeSalaries: JobFormInput["typeSalaries"];
  if (v.typeSalaries) {
    typeSalaries = {};
    for (const [type, salary] of Object.entries(v.typeSalaries)) {
      const resolved: TypeSalaryInput = {
        salaryMin: salary.salaryMin,
        salaryMax: salary.salaryMax,
        salaryPeriod: salary.salaryPeriod,
        salaryMonths: salary.salaryPeriod === "month" ? (salary.salaryMonths ?? null) : null,
        salaryBasis: salary.salaryBasis ?? "gross",
      };
      typeSalaries[type as EmploymentType] = resolved;
    }
  }

  const input: JobFormInput = {
    title: v.title,
    description: v.description,
    language: v.language,
    seniority: v.seniority,
    workModel: v.workModel,
    locationId,
    categoryId: category.id,
    salaryMin: v.salaryMin,
    salaryMax: v.salaryMax,
    salaryPeriod: v.salaryPeriod,
    salaryMonths: v.salaryPeriod === "month" ? (v.salaryMonths ?? null) : null,
    salaryBasis: v.salaryBasis,
    employmentTypes: v.employmentTypes ?? [v.employmentType!],
    typeSalaries,
    techTags: resolvedTechTags,
    languages: resolvedLanguages,
    externalApplyUrl: v.externalApplyUrl,
    expiresAt: v.expiresAt ?? null,
    publish: v.publish,
    salaryPublic: v.salaryPublic,
  };

  return { ok: true, input };
}
