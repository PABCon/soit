// Operator tool (§claim-invites) — creates one unclaimed company + its
// draft jobs + a claim link, for the "claim your profile" outreach flow.
// No admin UI exists for this yet (deliberately — see claim-invites.ts's
// own doc comment), so this is the real tool: copy this file per prospect,
// edit companyName/website/jobsListingUrl below, then run:
//
//   set -a && source .env.local && set +a && npx tsx scripts/create-unclaimed-company.ts
//
// Writes real rows to whichever Supabase project .env.local points at —
// confirm that's the live project before running this against a real
// prospect. The printed claimUrl uses NEXT_PUBLIC_SITE_URL from your
// environment (commonly localhost in .env.local) — swap the host for
// https://justit.pt before actually emailing anyone the link.
import { createClient } from "@supabase/supabase-js";
import { extractJobLinksFromUrl } from "../src/lib/ai/extract-job-links";
import { extractJobFromUrl, type ExtractedJob } from "../src/lib/ai/extract-job";
import { extractCompanyProfileFromUrl } from "../src/lib/ai/extract-company-profile";
import { resolveExtractedJobVocab } from "../src/lib/jobs/resolve-vocab";
import { createUnclaimedCompanyWithJobs } from "../src/lib/db/claim-invites";
import { recordImportedSource } from "../src/lib/db/job-imports";
import type { JobFormInput } from "../src/lib/db/jobs";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// EDIT PER PROSPECT:
const companyWebsite = "https://www.wearemeta.io";
const companyName = "We Are Meta";
// We Are Meta's own /careers listing is JS-rendered (extractJobLinksFromUrl
// returns empty_content against it, confirmed) — its real job data comes
// from a WordPress AJAX endpoint (admin-ajax.php?action=load_jobs) that
// isn't a "listing page" extractJobLinksFromUrl can crawl. When a
// prospect's listing is like this, leave jobsListingUrl set (still used
// for the claim-page "where we found you" framing / as a fallback) but
// populate MANUAL_JOB_URLS with real individual job-detail links found by
// hand — each one is itself normal server-rendered content, so
// extractJobFromUrl still works fine on it directly. Leave this empty for
// the normal case (a site, or itjobs.pt's company page, that
// extractJobLinksFromUrl can actually discover).
const jobsListingUrl = "https://www.wearemeta.io/careers/";
const MANUAL_JOB_URLS: string[] = [
  "https://www.wearemeta.io/careers/job/5795", // Senior Fullstack Developer (Java & Angular)
  "https://www.wearemeta.io/careers/job/5784", // Senior AI Engineer
  "https://www.wearemeta.io/careers/job/5776", // Product Manager
  "https://www.wearemeta.io/careers/job/5777", // Senior DevOps Engineer
  "https://www.wearemeta.io/careers/job/5766", // QA Automation Engineer (French Speaker)
  "https://www.wearemeta.io/careers/job/5539", // Data Engineer
  "https://www.wearemeta.io/careers/job/5624", // Cybersecurity Expert
  "https://www.wearemeta.io/careers/job/5498", // Senior iOS Developer
];
// Hard cap on how many of the discovered jobs to actually pull in as
// drafts — a real prospect page can list dozens; the claim page only
// needs enough to make the "look what's already done" point, not every
// single one (and each extraction is a real LLM call).
const MAX_JOBS = 10;

async function main() {
  let jobUrls: string[];
  if (MANUAL_JOB_URLS.length > 0) {
    console.log(`Using ${MANUAL_JOB_URLS.length} manually-supplied job URLs (listing page isn't crawlable)`);
    jobUrls = MANUAL_JOB_URLS.slice(0, MAX_JOBS);
  } else {
    console.log("Discovering job links from", jobsListingUrl);
    const discovery = await extractJobLinksFromUrl(jobsListingUrl);
    if (!discovery.ok) {
      console.log("FAILED discovering job links:", discovery.reason);
      return;
    }
    console.log(`Found ${discovery.links.length} job links${discovery.truncated ? " (truncated — more may exist)" : ""}`);
    jobUrls = discovery.links.slice(0, MAX_JOBS).map((l) => l.url);
  }

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

  // Bump the pilot's slot cap above the default (1) so a real follow-up
  // import (any remaining roles, run later through the console once
  // claimed) isn't immediately blocked by this pilot batch alone.
  await admin.from("companies").update({ job_ad_slot_cap: 20 }).eq("id", result.companyId);

  // Register each pilot job's source URL in job_import_sources so a real
  // future import run against the same source correctly skips these as
  // already-imported instead of creating duplicates.
  for (let i = 0; i < extractedJobs.length; i++) {
    await recordImportedSource(result.companyId, extractedJobs[i].url, result.jobIds[i]);
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
