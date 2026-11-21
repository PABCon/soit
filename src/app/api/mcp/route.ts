import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
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
import { encodeState as encodeSalaryState } from "@/lib/salary-calculator/url-state";
import { encodeState as encodeTerminationState } from "@/lib/termination-calculator/url-state";

/**
 * Just IT's public MCP server (§MCP item): any MCP-compatible client
 * (Claude Desktop, Claude Code, or anything else that speaks the
 * protocol) can search real jobs, look up a real company, and run both
 * calculators directly, the same real, read-only tools `/api/assistant`
 * already exposes to JT, just reachable from outside justit.pt entirely.
 *
 * Deliberately read-only for this first version, the exact same
 * boundary the chat assistant plan drew between "search/discovery" (built
 * first, zero auth needed) and "apply/favorites" (needs a real session,
 * explicit confirmation, deferred). Exposing a write action through MCP
 * properly needs the protocol's own OAuth flow, a separate, bigger piece
 * of work, not bolted on here.
 *
 * Stateless by design (`sessionIdGenerator: undefined`): there is no
 * multi-turn MCP session to persist across serverless invocations that
 * may each land on a different, isolated function instance, and none of
 * these tools need one, each call is a complete, independent request,
 * same as this project's own public v1 API. A fresh McpServer + transport
 * per request is the correct, documented pattern for exactly this case
 * (`WebStandardStreamableHTTPServerTransport`'s own doc comment calls
 * stateless mode out as "good for simple API-style servers").
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Same anonymous-abuse concern the public v1 API's own rate limiter
// documents, just keyed by IP instead of a company id, nothing else
// identifies an anonymous MCP caller. 30 requests/60s is generous for a
// real client's normal tool-call cadence while still giving abuse an
// actual ceiling.
const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  prefix: "mcp-ratelimit",
});

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "just-it", version: "1.0.0" });

  server.registerTool(
    "search_jobs",
    {
      title: "Search IT jobs in Portugal",
      description:
        "Search live IT job postings on Just IT by technology, category, location, seniority, work model, employment type, required language, remote-only, or minimum monthly salary (EUR). Every result always has a real salary, Just IT never publishes a job without one.",
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
      if (!(await ratelimit.limit("search_jobs")).success) {
        return { content: [{ type: "text" as const, text: "Rate limited, please slow down." }], isError: true };
      }
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
      const result = searchJobs(allJobs, args, vocab);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
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
      if (!(await ratelimit.limit("lookup_company")).success) {
        return { content: [{ type: "text" as const, text: "Rate limited, please slow down." }], isError: true };
      }
      const companies = await getVerifiedCompanies();
      const companyVocab = companies.map((c) => ({ slug: c.slug, name: c.name }));
      const match = findMatchingCompany(name, companyVocab);
      if (!match) return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, reason: "not_found" }) }] };
      const company = await getCompanyBySlug(match.slug);
      if (!company) return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, reason: "not_found" }) }] };
      const allJobs = await getLiveJobs();
      const openJobsCount = allJobs.filter((j) => j.company.slug === match.slug).length;
      const result = {
        ok: true,
        slug: company.slug,
        name: company.name,
        description: company.description,
        industry: company.industry,
        companySize: company.companySize,
        openJobsCount,
        url: `${SITE}/en/companies/${company.slug}`,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
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
      if (!(await ratelimit.limit("calculate_net_salary")).success) {
        return { content: [{ type: "text" as const, text: "Rate limited, please slow down." }], isError: true };
      }
      const calc = calculateSalary(args);
      const result = calc.ok ? { ...calc, shareUrl: `${SITE}/en/salario-liquido?s=${encodeSalaryState(calc.state)}` } : calc;
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
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
      if (!(await ratelimit.limit("calculate_termination")).success) {
        return { content: [{ type: "text" as const, text: "Rate limited, please slow down." }], isError: true };
      }
      const calc = calculateTermination(args);
      const result = calc.ok ? { ...calc, shareUrl: `${SITE}/en/rescisao-contrato?s=${encodeTerminationState(calc.state)}` } : calc;
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    },
  );

  return server;
}

async function handle(req: Request): Promise<Response> {
  const ip = clientIp(req);
  const { success } = await ratelimit.limit(`connect:${ip}`);
  if (!success) return new Response("Too many requests", { status: 429 });

  const server = buildServer();
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
