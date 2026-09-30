import { authenticateApiRequest } from "@/lib/api/auth";
import { apiError } from "@/lib/api/errors";
import { resolveJobRefs } from "@/lib/api/resolve-refs";
import { getAllCompanyJobsForApi, saveJob } from "@/lib/db/jobs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return apiError(auth.status, auth.error, "Authentication failed");

  const jobs = await getAllCompanyJobsForApi(auth.companyId);
  return Response.json({
    jobs: jobs.map((j) => ({ ...j, url: `${SITE}${j.path}` })),
  });
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return apiError(auth.status, auth.error, "Authentication failed");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON");
  }

  const resolved = await resolveJobRefs(body);
  if (!resolved.ok) return apiError(resolved.status, resolved.error, resolved.message);

  const result = await saveJob(null, resolved.input, { companyId: auth.companyId });
  return Response.json(
    {
      id: result.id,
      slug: result.slug,
      url: `${SITE}/${resolved.input.language}/jobs/${result.slug}`,
      status: result.published ? "published" : "draft",
      message: result.message,
    },
    { status: 201 },
  );
}
