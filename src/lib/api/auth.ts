import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApiAuthResult = { ok: true; companyId: string } | { ok: false; status: number; error: string };

/** The only place `company_api_keys.key_hash` is ever read — there is no
 *  cookie session behind an API-key request at all, so this has to use
 *  the admin client, same as every other cross-session lookup in this
 *  codebase. Ownership of anything the caller then touches is still
 *  re-checked explicitly against `companyId` at each call site, same
 *  defense-in-depth convention `saveJob`/`setJobStatus`/`deleteJob`
 *  already use. Checks `top_employer_active` live on every request —
 *  a lapsed subscription revokes API access immediately, not just new
 *  key generation. */
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization");
  const key = header?.match(/^Bearer\s+(.+)$/)?.[1];
  if (!key) return { ok: false, status: 401, error: "missing_api_key" };

  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("company_api_keys")
    .select("company_id, revoked_at, companies!inner(top_employer_active)")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!row || row.revoked_at) return { ok: false, status: 401, error: "invalid_api_key" };

  const company = row.companies as unknown as { top_employer_active: boolean };
  if (!company.top_employer_active) return { ok: false, status: 403, error: "not_top_employer" };

  void admin
    .from("company_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash)
    .then(
      () => {},
      () => {},
    );

  return { ok: true, companyId: row.company_id };
}
