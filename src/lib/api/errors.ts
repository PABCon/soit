export function apiError(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status });
}
