import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkCandidateApiRateLimit } from "./rate-limit";

export type CandidateApiAuthResult = { ok: true; candidateId: string } | { ok: false; status: number; error: string };

/** The candidate-MCP mirror of `authenticateApiRequest()` — a Bearer
 *  `sitc_live_...` personal access token, sha256-looked-up against
 *  `candidate_api_keys` via the admin client (no cookie session exists
 *  for this kind of request at all). No paid-tier check: candidate-side
 *  stays free, so there's nothing equivalent to `top_employer_active`
 *  to re-verify here. */
export async function authenticateCandidateApiRequest(request: Request): Promise<CandidateApiAuthResult> {
  const header = request.headers.get("authorization");
  const key = header?.match(/^Bearer\s+(.+)$/)?.[1];
  if (!key) return { ok: false, status: 401, error: "missing_api_key" };

  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("candidate_api_keys")
    .select("candidate_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!row || row.revoked_at) return { ok: false, status: 401, error: "invalid_api_key" };

  void admin
    .from("candidate_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash)
    .then(
      () => {},
      () => {},
    );

  const withinLimit = await checkCandidateApiRateLimit(row.candidate_id);
  if (!withinLimit) return { ok: false, status: 429, error: "rate_limited" };

  return { ok: true, candidateId: row.candidate_id };
}
