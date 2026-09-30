import { authenticateApiRequest } from "@/lib/api/auth";
import { apiError } from "@/lib/api/errors";
import { getJobCategories } from "@/lib/db/job-categories";
import { getLocations } from "@/lib/db/locations";
import { getTechTags } from "@/lib/db/tech-tags";
import { getSpokenLanguages } from "@/lib/db/spoken-languages";

// Lets an integrator map their own data to this product's slugs without
// guessing — the same reference tables `POST /jobs` resolves slugs
// against. Enums are fixed and just documented here, not looked up.
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return apiError(auth.status, auth.error, "Authentication failed");

  const [categories, locations, techTags, languages] = await Promise.all([
    getJobCategories(),
    getLocations(),
    getTechTags(),
    getSpokenLanguages(),
  ]);

  return Response.json({
    categories: categories.map((c) => ({ slug: c.slug, label: c.label })),
    locations: locations.map((l) => ({ slug: l.slug, name: l.name })),
    techTags: techTags.map((t) => ({ slug: t.slug, label: t.label })),
    languages: languages.map((l) => ({ slug: l.slug, label: l.label })),
    enums: {
      seniority: ["junior", "mid", "senior", "lead"],
      workModel: ["remote", "hybrid", "office"],
      salaryPeriod: ["hour", "day", "month", "year"],
      employmentType: ["permanent", "fixed_term", "contractor", "freelance", "internship"],
      jobLanguage: ["pt", "en"],
      skillLevel: ["basic", "intermediate", "advanced", "expert"],
    },
  });
}
