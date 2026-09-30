import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getMyEmployerContext } from "@/lib/db/companies";

export type CompanyApiKey = {
  id: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

/** The owner's own row, written through their normal RLS-permitted
 *  session — no admin client needed, same as `updateCompanyProfile`. */
export async function getMyApiKey(): Promise<CompanyApiKey | null> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("company_api_keys")
    .select("id, key_prefix, created_at, last_used_at, revoked_at")
    .eq("company_id", ctx.company.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    keyPrefix: data.key_prefix,
    createdAt: data.created_at,
    lastUsedAt: data.last_used_at,
    revokedAt: data.revoked_at,
  };
}

const KEY_PREFIX = "sit_live_";

/** Generates a new key, revoking any currently-active one for this
 *  company first — one active key per company at a time (v1 scope).
 *  The full secret is returned once and never stored; only its sha256
 *  hash and a short display prefix persist. */
export async function generateApiKey(): Promise<{ key: string; keyPrefix: string }> {
  const ctx = await getMyEmployerContext();
  if (!ctx) throw new Error("Not an employer");
  if (ctx.role !== "owner") throw new Error("Only an owner can manage API keys");

  const supabase = await createClient();

  await supabase
    .from("company_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("company_id", ctx.company.id)
    .is("revoked_at", null);

  const secret = crypto.randomBytes(24).toString("base64url");
  const key = `${KEY_PREFIX}${secret}`;
  const keyPrefix = key.slice(0, 16);
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  const { error } = await supabase.from("company_api_keys").insert({
    company_id: ctx.company.id,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    created_by: ctx.employerId,
  });
  if (error) throw new Error(error.message);

  return { key, keyPrefix };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const ctx = await getMyEmployerContext();
  if (!ctx) throw new Error("Not an employer");

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("company_id", ctx.company.id);
  if (error) throw new Error(error.message);
}
