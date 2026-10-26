// Operator tool (§claim-invites) — creates one unclaimed company + its
// draft jobs + a claim link, for the "claim your profile" outreach flow.
// No admin UI exists for this yet (deliberately — see claim-invites.ts's
// own doc comment), so this is the real tool: copy this file per prospect,
// edit companyName/website/jobUrls below, then run:
//
//   set -a && source .env.local && set +a && npx tsx scripts/create-unclaimed-company.ts
//
// Writes real rows to whichever Supabase project .env.local points at —
// confirm that's the live project before running this against a real
// prospect. The printed claimUrl uses NEXT_PUBLIC_SITE_URL from your
// environment (commonly localhost in .env.local) — swap the host for
// https://justit.pt before actually emailing anyone the link.
import { createClient } from "@supabase/supabase-js";
import { extractJobFromUrl, type ExtractedJob } from "../src/lib/ai/extract-job";
import { extractCompanyProfileFromUrl } from "../src/lib/ai/extract-company-profile";
import { resolveExtractedJobVocab } from "../src/lib/jobs/resolve-vocab";
import { createUnclaimedCompanyWithJobs } from "../src/lib/db/claim-invites";
import type { JobFormInput } from "../src/lib/db/jobs";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// EDIT PER PROSPECT:
const companyWebsite = "https://www.issworld.com";
const companyName = "ISS Facility Services Portugal";
const jobUrls = [
  "https://jobs.issworld.com/job/Porto-Senior-Machine-Learning-Engineer-4000-457/1367661157/",
  "https://jobs.issworld.com/job/Porto-IT-Application-Manager-4000-457/1369613457/",
  "https://jobs.issworld.com/job/Porto-Solution-Architect-4000-457/1363868957/",
  "https://jobs.issworld.com/job/Porto-Cloud-Hosting-Engineer-%28Kubernetes%29-4000-457/1351006857/",
  "https://jobs.issworld.com/job/Porto-Platform-Engineer-%28Analytics%2C-Data-&amp;-AI%29-4000-457/1369000157/",
];

async function main() {
  console.log("Fetching company profile...");
  const profileResult = await extractCompanyProfileFromUrl(companyWebsite);
  console.log("profile ok:", profileResult.ok, profileResult.ok ? profileResult.data.tagline : profileResult.reason);

  const [{ data: jobCategories }, { data: techTags }, { data: spokenLanguages }] = await Promise.all([
    admin.from("job_categories").select("id, label"),
    admin.from("tech_tags").select("id, slug, label, aliases"),
    admin.from("spoken_languages").select("id, label"),
  ]);
  const categoryLabels = (jobCategories ?? []).map((c: { label: string }) => c.label);

  const extractedJobs: { data: ExtractedJob; url: string }[] = [];
  for (const url of jobUrls) {
    const extracted = await extractJobFromUrl(url, { categoryLabels });
    if (!extracted.ok) {
      console.log("FAILED extracting", url, extracted.reason);
      continue;
    }
    console.log("extracted:", extracted.data.title);
    extractedJobs.push({ data: extracted.data, url });
  }

  console.log(`Creating unclaimed company with ${extractedJobs.length} draft jobs...`);
  const result = await createUnclaimedCompanyWithJobs(
    {
      companyName,
      website: companyWebsite,
      logoUrl: profileResult.ok ? profileResult.logoUrl : null,
      industry: profileResult.ok ? profileResult.data.industry : null,
      companySize: profileResult.ok ? profileResult.data.companySize : null,
      description: profileResult.ok ? profileResult.data.tagline : null,
    },
    async (companyId: string) => {
      const jobInputs: JobFormInput[] = [];
      for (const { data, url } of extractedJobs) {
        const resolved = await resolveExtractedJobVocab(
          data,
          { techTags: techTags ?? [], jobCategories: jobCategories ?? [], spokenLanguages: spokenLanguages ?? [] },
          companyId,
          companyName,
        );
        jobInputs.push({
          title: data.title ?? "Untitled role",
          description: data.description ?? "",
          language: data.adLanguage ?? "en",
          seniority: data.seniority ?? "mid",
          workModel: data.workModel ?? "office",
          locationId: null,
          categoryId: resolved.categoryId,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
          salaryPeriod: data.salaryPeriod ?? "month",
          salaryMonths: null,
          salaryBasis: "gross",
          employmentTypes: [data.employmentType ?? "permanent"],
          techTags: resolved.techTags,
          languages: resolved.languages,
          externalApplyUrl: url,
          expiresAt: null,
          publish: false,
          salaryPublic: true,
        });
      }
      return jobInputs;
    },
  );
  console.log(JSON.stringify(result, null, 2));
}

main();
