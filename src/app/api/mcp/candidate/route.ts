import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { authenticateCandidateApiRequest } from "@/lib/api/candidate-auth";
import { getLiveJobs } from "@/lib/db/jobs";
import { getTechTags } from "@/lib/db/tech-tags";
import { getJobCategories } from "@/lib/db/job-categories";
import { getLocations } from "@/lib/db/locations";
import { getSpokenLanguages } from "@/lib/db/spoken-languages";
import { getVerifiedCompanies, getCompanyBySlug } from "@/lib/db/companies";
import { searchJobs, type SearchJobsArgs, type SearchJobsVocab } from "@/lib/assistant/search-jobs";
import { findMatchingCompany } from "@/lib/assistant/lookup-company";
import { calculateSalary, type CalculateSalaryArgs } from "@/lib/assistant/calculate-salary";
import { calculateTermination, type CalculateTerminationArgs } from "@/lib/assistant/calculate-termination";
import { previewApply, confirmApply } from "@/lib/assistant/apply-job";
import { toggleFavoriteForJob } from "@/lib/assistant/toggle-favorite";
import { encodeState as encodeSalaryState } from "@/lib/salary-calculator/url-state";
import { encodeState as encodeTerminationState } from "@/lib/termination-calculator/url-state";

/**
 * The candidate-authenticated counterpart to the public, anonymous
 * `/api/mcp`: the same search/company-lookup/calculator tools plus the
 * three write actions JT already does in chat (apply, favorite), now
 * reachable from any MCP client via a personal access token instead of
 * a browser session. Free — candidate-side features stay free per this
 * project's own standing economics, there's no billing concept here the
 * way there is on `/api/mcp/company`.
 *
 * Identity comes entirely from `authenticateCandidateApiRequest()` (a
 * Bearer `sitc_live_...` token, looked up against `candidate_api_keys`)
 * and is threaded into `previewApply`/`confirmApply`/`toggleFavoriteForJob`
 * via the same `CandidateIdOverride` escape hatch `jobs.ts`'s
 * `JobWriteOverride` already established for the company API — never a
 * tool argument, never anything a client could spoof.
 *
 * apply still has its own preview/confirm split, matching JT's own
 * "never submit without an explicit, deliberate second step" discipline
 * — a real application affects a real employer and counts against a
 * daily cap, worth keeping a two-call shape even outside a chat
 * conversation. `confirmApply` re-validates everything itself on every
 * call (live job, not already applied, under the cap), the same as it
 * already does for JT.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function buildCandidateServer(candidateId: string): McpServer {
  const server = new McpServer({ name: "just-it-candidate", version: "1.0.0" });

  server.registerTool(
    "search_jobs",
    {
      title: "Search IT jobs in Portugal",
      description:
        "Search live IT job postings on Just IT by technology, category, location, seniority, work model, employment type, required language, remote-only, or minimum monthly salary (EUR).",
      inputSchema: {
        q: z.string().optional().describe("Free-text keyword to match against the job title"),
        tech: z.array(z.string()).optional().describe("Technology names in their common spelling, e.g. 'React', 'Python'"),
        categorySlug: z.string().optional(),
        seniority: z.array(z.enum(["junior", "mid", "senior", "lead"])).optional(),
        workModel: z.array(z.enum(["remote", "hybrid", "office"])).optional(),
        employmentType: z.array(z.enum(["permanent", "fixed_term", "contractor", "freelance", "internship"])).optional(),
        reqLanguageSlug: z.array(z.string()).optional(),
        remoteOnly: z.boolean().optional(),
        minSalary: z.number().optional().describe("Minimum monthly gross salary in EUR"),
        locationSlug: z.string().optional().describe("A curated Portuguese city slug, e.g. 'lisboa', 'porto'"),
        radiusKm: z.number().optional().describe("Search radius in km around locationSlug, defaults to 25"),
      },
    },
    async (args: SearchJobsArgs) => {
      const [allJobs, techTags, categories, locations, languages] = await Promise.all([
        getLiveJobs(),
        getTechTags(),
        getJobCategories(),
        getLocations(),
        getSpokenLanguages(),
      ]);
      const vocab: SearchJobsVocab = {
        tech: techTags.map((t) => ({ label: t.label, aliases: t.aliases })),
        categorySlugs: categories.map((c) => c.slug),
        languageSlugs: languages.map((l) => l.slug),
        locations: locations.map((l) => ({ slug: l.slug, latitude: l.latitude, longitude: l.longitude })),
      };
      return ok(searchJobs(allJobs, args, vocab));
    },
  );

  server.registerTool(
    "lookup_company",
    {
      title: "Look up a company on Just IT",
      description: "Look up a verified company's real public profile by name: industry, size, description, and how many jobs it currently has open.",
      inputSchema: { name: z.string().describe("The company name, as written, not case-sensitive") },
    },
    async ({ name }: { name: string }) => {
      const companies = await getVerifiedCompanies();
      const companyVocab = companies.map((c) => ({ slug: c.slug, name: c.name }));
      const match = findMatchingCompany(name, companyVocab);
      if (!match) return ok({ ok: false, reason: "not_found" });
      const company = await getCompanyBySlug(match.slug);
      if (!company) return ok({ ok: false, reason: "not_found" });
      const allJobs = await getLiveJobs();
      const openJobsCount = allJobs.filter((j) => j.company.slug === match.slug).length;
      return ok({
        ok: true,
        slug: company.slug,
        name: company.name,
        description: company.description,
        industry: company.industry,
        companySize: company.companySize,
        openJobsCount,
        url: `${SITE}/en/companies/${company.slug}`,
      });
    },
  );

  server.registerTool(
    "calculate_net_salary",
    {
      title: "Calculate net salary in Portugal",
      description: "Compute take-home/net salary for a regular job (employment), recibos verdes (freelance), or an own-company (Lda) setup in Portugal, including IRS Jovem and IFICI.",
      inputSchema: {
        mode: z.enum(["employment", "freelance", "company"]),
        age: z.number().optional(),
        region: z.enum(["continente", "madeira", "acores"]).optional(),
        maritalStatus: z.enum(["single", "married_two_earners", "married_single_earner"]).optional(),
        disabilityAbove60: z.boolean().optional(),
        irsJovemEnabled: z.boolean().optional(),
        irsJovemBenefitYear: z.number().min(1).max(10).optional(),
        flatRate20: z.boolean().optional().describe("Self-declared IFICI/RNH flat-20% regime"),
        grossMonthly: z.number().optional().describe("Required for employment mode"),
        paymentsPerYear: z.union([z.literal(12), z.literal(14)]).optional(),
        billingAmount: z.number().optional().describe("Required for freelance/company mode"),
        billingMode: z.enum(["monthly", "annual", "dayRate"]).optional(),
        activityType: z.enum(["art151", "other_services"]).optional(),
        clientLocation: z.enum(["pt", "eu", "non_eu"]).optional(),
        monthsSinceStart: z.number().optional(),
        gerenteGrossMonthly: z.number().optional().describe("Required for company mode"),
      },
    },
    async (args: CalculateSalaryArgs) => {
      const calc = calculateSalary(args);
      return ok(calc.ok ? { ...calc, shareUrl: `${SITE}/en/salario-liquido?s=${encodeSalaryState(calc.state)}` } : calc);
    },
  );

  server.registerTool(
    "calculate_termination",
    {
      title: "Calculate termination/severance pay in Portugal",
      description: "Compute severance, notice, or mutual-agreement entitlements when a job ends in Portugal.",
      inputSchema: {
        scenario: z.enum(["dismissal", "fixed_term", "resignation", "mutual_agreement"]),
        monthlyRemuneration: z.number(),
        contractStartDate: z.string().describe("ISO date, YYYY-MM-DD"),
        cessationDate: z.string().optional().describe("ISO date, YYYY-MM-DD, defaults to today"),
        unusedPriorYearHolidayDays: z.number().optional(),
        contractType: z.enum(["open_ended", "fixed_term"]).optional().describe("Required for the resignation scenario"),
        fixedTermOriginalDurationMonths: z.number().optional(),
        noticeDaysPlanned: z.number().optional().describe("Required for the resignation scenario"),
        offeredAmount: z.number().optional().describe("Required for the mutual_agreement scenario"),
      },
    },
    async (args: CalculateTerminationArgs) => {
      const calc = calculateTermination(args);
      return ok(calc.ok ? { ...calc, shareUrl: `${SITE}/en/rescisao-contrato?s=${encodeTerminationState(calc.state)}` } : calc);
    },
  );

  server.registerTool(
    "preview_apply",
    {
      title: "Preview applying to a job",
      description: "Preview applying to a specific job before submitting anything. Always call this before confirm_apply.",
      inputSchema: { jobId: z.string().describe("The job's id, from a prior search_jobs result") },
    },
    async ({ jobId }: { jobId: string }) => {
      const allJobs = await getLiveJobs();
      const job = allJobs.find((j) => j.id === jobId);
      if (!job) return ok({ ok: false, reason: "job_not_found" });
      return ok(await previewApply(job, { candidateId }));
    },
  );

  server.registerTool(
    "confirm_apply",
    {
      title: "Submit an application",
      description: "Actually submits an application using the candidate's stored CV. Only call this after preview_apply reported ok:true.",
      inputSchema: {
        jobSlug: z.string().describe("The job's slug, from a prior search_jobs result"),
        coverNote: z.string().optional(),
      },
    },
    async ({ jobSlug, coverNote }: { jobSlug: string; coverNote?: string }) => {
      return ok(await confirmApply(jobSlug, coverNote, { candidateId }));
    },
  );

  server.registerTool(
    "toggle_favorite",
    {
      title: "Save or unsave a job",
      description: "Saves a job as a favorite, or removes it if it's already saved (toggles automatically).",
      inputSchema: { jobId: z.string().describe("The job's id, from a prior search_jobs result") },
    },
    async ({ jobId }: { jobId: string }) => {
      const allJobs = await getLiveJobs();
      const job = allJobs.find((j) => j.id === jobId);
      if (!job) return ok({ ok: false, reason: "job_not_found" });
      return ok(await toggleFavoriteForJob(job, { candidateId }));
    },
  );

  return server;
}

async function handle(req: Request): Promise<Response> {
  const auth = await authenticateCandidateApiRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error, message: "Authentication failed" }, { status: auth.status });

  const server = buildCandidateServer(auth.candidateId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function DELETE(req: Request) {
  return handle(req);
}
