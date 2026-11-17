import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/api/auth";
import { apiError } from "@/lib/api/errors";
import { resolveJobRefs } from "@/lib/api/resolve-refs";
import { getAllCompanyJobsForApi, getCompanyJobById, saveJob, setJobStatus, deleteJob } from "@/lib/db/jobs";
import { getJobCategories } from "@/lib/db/job-categories";
import { getLocations } from "@/lib/db/locations";
import { getTechTags } from "@/lib/db/tech-tags";
import { getSpokenLanguages } from "@/lib/db/spoken-languages";

/**
 * The MCP flavor of the existing, paid Top Employer "API access" perk
 * (`/api/v1/*`, `/recruit/api`) — same gate, same key, same underlying
 * `src/lib/db/jobs.ts`/`resolve-refs.ts` functions, just reachable via
 * MCP for a client that'd rather call tools than hand-roll REST calls.
 * Every tool here wraps the identical function its REST counterpart
 * already calls (`saveJob`/`setJobStatus`/`deleteJob`/`getCompanyJobById`/
 * `getAllCompanyJobsForApi`, all via the `override: {companyId}` escape
 * hatch those functions already support) — never a second, parallel
 * implementation that could drift from what the REST API itself does.
 *
 * Auth is `authenticateApiRequest()`, the exact function `/api/v1/*`
 * uses: a Bearer `sit_live_...` key, sha256-looked-up against
 * `company_api_keys`, `top_employer_active` re-checked live on every
 * request (a lapsed subscription revokes access immediately), its own
 * existing per-company rate limit. A bad/missing/unauthorized key gets
 * the same plain REST-shaped `apiError()` response the REST API already
 * returns for the same failure — before any MCP handshake even starts.
 *
 * Stateless (`sessionIdGenerator: undefined`), same reasoning as the
 * public `/api/mcp`: no multi-turn session to persist across serverless
 * invocations, a fresh server+transport per request.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function err(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], isError: true };
}

const skillLevel = z.enum(["basic", "intermediate", "advanced", "expert"]);
const salaryBasis = z.enum(["gross", "net"]);
const employmentType = z.enum(["permanent", "fixed_term", "contractor", "freelance", "internship"]);

const typeSalaryShape = {
  salaryMin: z.number().positive(),
  salaryMax: z.number().positive(),
  salaryPeriod: z.enum(["hour", "day", "month", "year"]),
  salaryMonths: z.number().int().min(12).max(14).nullable().optional(),
  salaryBasis: salaryBasis.optional(),
};

// Mirrors `resolve-refs.ts`'s own `jobBodySchema` field-for-field — the
// real cross-field validation (slug resolution, required-unless-remote
// location, exactly-one-of employmentType/employmentTypes, etc.) still
// happens inside `resolveJobRefs()` itself once the tool callback hands
// it these args; this shape exists only for MCP client-side discovery/
// type hints, same relationship the public v1 API's own zod schema has
// to its REST JSON body.
const jobFieldsShape = {
  title: z.string().min(1),
  description: z.string().min(1),
  language: z.enum(["pt", "en"]),
  seniority: z.enum(["junior", "mid", "senior", "lead"]),
  workModel: z.enum(["remote", "hybrid", "office"]),
  categorySlug: z.string().min(1),
  locationSlug: z.string().min(1).nullable().optional().describe("Required unless workModel is \"remote\""),
  salaryMin: z.number().positive(),
  salaryMax: z.number().positive().nullable().optional().describe("Optional — only the minimum is required to publish"),
  salaryPeriod: z.enum(["hour", "day", "month", "year"]),
  salaryMonths: z.number().int().min(12).max(14).nullable().optional(),
  salaryBasis: salaryBasis.optional().describe("Defaults to \"gross\""),
  employmentType: employmentType.optional().describe("Singular, legacy — give this or employmentTypes"),
  employmentTypes: z.array(employmentType).min(1).optional().describe("Plural, preferred — give this or employmentType"),
  typeSalaries: z
    .record(z.string(), z.object(typeSalaryShape))
    .optional()
    .describe("A distinct salary range for an additional accepted contract type, keyed by that employment type"),
  techTags: z.array(z.object({ slug: z.string().min(1), level: skillLevel.nullable().optional(), required: z.boolean().optional() })).optional(),
  languages: z.array(z.object({ slug: z.string().min(1), level: skillLevel.nullable().optional() })).optional(),
  externalApplyUrl: z.string().optional(),
  expiresAt: z.string().nullable().optional().describe("ISO date, or null for the default 30-day window"),
  publish: z.boolean().optional().describe("false saves as a draft"),
  salaryPublic: z.boolean().optional().describe("Defaults to true"),
};

function buildCompanyServer(companyId: string): McpServer {
  const server = new McpServer({ name: "just-it-employer", version: "1.0.0" });

  server.registerTool(
    "list_reference",
    {
      title: "List reference data",
      description: "Real category/location/tech-tag/spoken-language slugs and the fixed enums, for building a create_job/update_job call.",
      inputSchema: {},
    },
    async () => {
      const [categories, locations, techTags, languages] = await Promise.all([
        getJobCategories(),
        getLocations(),
        getTechTags(),
        getSpokenLanguages(),
      ]);
      return ok({
        categories: categories.map((c) => ({ slug: c.slug, label: c.label })),
        locations: locations.map((l) => ({ slug: l.slug, name: l.name, country: l.country })),
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
    },
  );

  server.registerTool(
    "list_jobs",
    { title: "List this company's jobs", description: "Every job this company has, any status, with its public URL.", inputSchema: {} },
    async () => {
      const jobs = await getAllCompanyJobsForApi(companyId);
      return ok({ jobs: jobs.map((j) => ({ ...j, url: `${SITE}${j.path}` })) });
    },
  );

  server.registerTool(
    "get_job",
    { title: "Get one job", description: "Full detail for one of this company's own jobs.", inputSchema: { jobId: z.string().min(1) } },
    async ({ jobId }: { jobId: string }) => {
      const job = await getCompanyJobById(companyId, jobId);
      if (!job) return err({ ok: false, error: "job_not_found" });
      return ok({ ...job, url: `${SITE}${job.path}` });
    },
  );

  server.registerTool(
    "create_job",
    { title: "Create a job", description: "Create a new job ad, as a draft (publish: false) or straight to published (publish: true).", inputSchema: jobFieldsShape },
    async (args) => {
      const resolved = await resolveJobRefs(args);
      if (!resolved.ok) return err({ ok: false, error: resolved.error, message: resolved.message });
      const result = await saveJob(null, resolved.input, { companyId });
      return ok({
        id: result.id,
        slug: result.slug,
        url: `${SITE}/${resolved.input.language}/jobs/${result.slug}`,
        status: result.published ? "published" : "draft",
        message: result.message,
      });
    },
  );

  server.registerTool(
    "update_job",
    {
      title: "Update a job",
      description: "Full replace of an existing job's fields — the whole body is expected, same shape as create_job, not a partial patch.",
      inputSchema: { jobId: z.string().min(1), ...jobFieldsShape },
    },
    async ({ jobId, ...rest }: { jobId: string } & Record<string, unknown>) => {
      const existing = await getCompanyJobById(companyId, jobId);
      if (!existing) return err({ ok: false, error: "job_not_found" });
      const resolved = await resolveJobRefs(rest);
      if (!resolved.ok) return err({ ok: false, error: resolved.error, message: resolved.message });
      const result = await saveJob(jobId, resolved.input, { companyId });
      return ok({
        id: result.id,
        slug: result.slug,
        url: `${SITE}/${resolved.input.language}/jobs/${result.slug}`,
        status: result.published ? "published" : "draft",
        message: result.message,
      });
    },
  );

  server.registerTool(
    "delete_job",
    { title: "Delete a job", description: "Permanently deletes a job. Refused if it has any applications — pause it instead.", inputSchema: { jobId: z.string().min(1) } },
    async ({ jobId }: { jobId: string }) => {
      const existing = await getCompanyJobById(companyId, jobId);
      if (!existing) return err({ ok: false, error: "job_not_found" });
      try {
        await deleteJob(jobId, { companyId });
        return ok({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (/foreign key/i.test(message)) {
          return err({ ok: false, error: "job_has_applications", message: "This job has applications and can't be deleted — pause it instead" });
        }
        throw e;
      }
    },
  );

  server.registerTool(
    "pause_job",
    { title: "Pause a job", description: "Takes a published job off the live feed without deleting it.", inputSchema: { jobId: z.string().min(1) } },
    async ({ jobId }: { jobId: string }) => {
      const existing = await getCompanyJobById(companyId, jobId);
      if (!existing) return err({ ok: false, error: "job_not_found" });
      return ok(await setJobStatus(jobId, "inactive", { companyId }));
    },
  );

  server.registerTool(
    "publish_job",
    { title: "Publish a job", description: "Publishes a draft or reactivates a paused job, spending an ad credit if one isn't already free.", inputSchema: { jobId: z.string().min(1) } },
    async ({ jobId }: { jobId: string }) => {
      const existing = await getCompanyJobById(companyId, jobId);
      if (!existing) return err({ ok: false, error: "job_not_found" });
      return ok(await setJobStatus(jobId, "published", { companyId }));
    },
  );

  return server;
}

async function handle(req: Request): Promise<Response> {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return apiError(auth.status, auth.error, "Authentication failed");

  const server = buildCompanyServer(auth.companyId);
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
