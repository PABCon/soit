import { authenticateApiRequest } from "@/lib/api/auth";
import { apiError } from "@/lib/api/errors";
import { getCompanyJobById, setJobStatus } from "@/lib/db/jobs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return apiError(auth.status, auth.error, "Authentication failed");

  const { id } = await params;
  const existing = await getCompanyJobById(auth.companyId, id);
  if (!existing) return apiError(404, "job_not_found", "No job with that id on this company");

  const result = await setJobStatus(id, "published", { companyId: auth.companyId });
  return Response.json(result);
}
