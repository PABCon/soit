import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

export type CandidateApiKey = {
  id: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

/** The candidate's own row, written through their normal RLS-permitted
 *  session — mirrors `src/lib/db/api-keys.ts`'s `getMyApiKey()` exactly,
 *  just candidate- instead of company-scoped, and with no Top-Employer
 *  gate (candidate-side is free). */
export async function getMyCandidateApiKey(): Promise<CandidateApiKey | null> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return null;

  const { data } = await supabase
    .from("candidate_api_keys")
    .select("id, key_prefix, created_at, last_used_at, revoked_at")
    .eq("candidate_id", candidateId)
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

const KEY_PREFIX = "sitc_live_";

/** Generates a new key, revoking any currently-active one for this
 *  candidate first — one active key per candidate at a time, same v1
 *  scope as the company key. The full secret is returned once and never
 *  stored; only its sha256 hash and a short display prefix persist. */
export async function generateCandidateApiKey(): Promise<{ key: string; keyPrefix: string }> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  await supabase
    .from("candidate_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("candidate_id", candidateId)
    .is("revoked_at", null);

  const secret = crypto.randomBytes(24).toString("base64url");
  const key = `${KEY_PREFIX}${secret}`;
  const keyPrefix = key.slice(0, 16);
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  const { error } = await supabase.from("candidate_api_keys").insert({
    candidate_id: candidateId,
    key_prefix: keyPrefix,
    key_hash: keyHash,
  });
  if (error) throw new Error(error.message);

  return { key, keyPrefix };
}

export async function revokeCandidateApiKey(keyId: string): Promise<void> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");

  const { error } = await supabase
    .from("candidate_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("candidate_id", candidateId);
  if (error) throw new Error(error.message);
}
