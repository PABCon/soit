import { authenticateApiRequest } from "@/lib/api/auth";
import { apiError } from "@/lib/api/errors";
import { resolveJobRefs } from "@/lib/api/resolve-refs";
import { getCompanyJobById, saveJob, deleteJob } from "@/lib/db/jobs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return apiError(auth.status, auth.error, "Authentication failed");

  const { id } = await params;
  const job = await getCompanyJobById(auth.companyId, id);
  if (!job) return apiError(404, "job_not_found", "No job with that id on this company");

  return Response.json({ ...job, url: `${SITE}${job.path}` });
}

/** Full replace, not a partial patch — the whole job body is expected,
 *  same shape as `POST /jobs`. Documented as such in the console's API
 *  docs so an integrator doesn't expect JSON-merge-patch semantics. */
export async function PUT(request: Request, { params }: Params) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return apiError(auth.status, auth.error, "Authentication failed");

  const { id } = await params;
  const existing = await getCompanyJobById(auth.companyId, id);
  if (!existing) return apiError(404, "job_not_found", "No job with that id on this company");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON");
  }

  const resolved = await resolveJobRefs(body);
  if (!resolved.ok) return apiError(resolved.status, resolved.error, resolved.message);

  const result = await saveJob(id, resolved.input, { companyId: auth.companyId });
  return Response.json({
    id: result.id,
    slug: result.slug,
    url: `${SITE}/${resolved.input.language}/jobs/${result.slug}`,
    status: result.published ? "published" : "draft",
    message: result.message,
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return apiError(auth.status, auth.error, "Authentication failed");

  const { id } = await params;
  const existing = await getCompanyJobById(auth.companyId, id);
  if (!existing) return apiError(404, "job_not_found", "No job with that id on this company");

  try {
    await deleteJob(id, { companyId: auth.companyId });
  } catch (err) {
    // Postgres foreign_key_violation — `applications.job_id ... on delete
    // restrict` (§15.1): a job with any applications can't be deleted,
    // only paused/closed. `deleteJob` only ever wraps a raw Postgres
    // error message in a plain Error, so a text match is what's left to
    // go on here.
    if (/foreign key/i.test((err as Error).message)) {
      return apiError(409, "job_has_applications", "This job has applications and can't be deleted — pause it instead");
    }
    throw err;
  }

  return new Response(null, { status: 204 });
}
