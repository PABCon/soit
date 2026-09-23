import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffFileType } from "@/lib/file-sniff";

export type CandidateProfile = {
  fullName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  skills: string[];
  hasCv: boolean;
};

/** RLS already scopes this to the caller's own row (`auth_user_id =
 *  auth.uid()`) — same pattern as `getMyApplications` in applications.ts,
 *  no explicit filter needed. */
export async function getMyCandidateProfile(): Promise<CandidateProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidates")
    .select("full_name, email, phone, linkedin_url, avatar_url, skills, cv_url")
    .maybeSingle();

  if (!data) return null;
  return {
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    linkedinUrl: data.linkedin_url,
    avatarUrl: data.avatar_url,
    skills: data.skills ?? [],
    hasCv: !!data.cv_url,
  };
}

export async function updateCandidateProfile(fields: {
  full_name: string;
  phone: string | null;
  linkedin_url: string | null;
  skills: string[];
}) {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) throw new Error("Not a candidate");
  // PostgREST requires an explicit filter on UPDATE regardless of RLS —
  // an unscoped .update() is rejected outright ("UPDATE requires a WHERE
  // clause"), it doesn't just implicitly rely on the RLS policy.
  const { error } = await supabase.from("candidates").update(fields).eq("id", candidateId);
  if (error) throw new Error(error.message);
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_CV_BYTES = 5 * 1024 * 1024; // matches applications.ts's per-application cap, §6.7

export type UploadResult =
  | { ok: true }
  | { ok: false; reason: "not_a_candidate" | "file_too_large" | "bad_file" | "upload_failed" };

export async function uploadCandidateAvatar(file: File): Promise<UploadResult> {
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, reason: "file_too_large" };
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return { ok: false, reason: "bad_file" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_a_candidate" };

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error } = await supabase
    .from("candidates")
    .update({ avatar_url: `${publicUrl.publicUrl}?v=${Date.now()}` })
    .eq("auth_user_id", user.id);
  if (error) return { ok: false, reason: "upload_failed" };

  return { ok: true };
}

/** A *master* CV, distinct from the per-application CVs `applyToJob`/
 *  `applyAnonymously` handle (src/lib/db/applications.ts) — same content-
 *  sniffing + size cap, duplicated rather than imported since that
 *  helper's path is job-scoped and this one isn't; it's ~10 lines, not
 *  worth forcing a shared abstraction over. */
export async function uploadCandidateCv(file: File): Promise<UploadResult> {
  if (file.size === 0 || file.size > MAX_CV_BYTES) return { ok: false, reason: "file_too_large" };

  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffFileType(bytes);
  if (!kind) return { ok: false, reason: "bad_file" };

  const path = `${candidateId}/profile-cv.${kind}`;
  const contentType =
    kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // The cvs bucket has no client policies at all (private, §6.3) — the
  // admin client is required here, same as every other CV write.
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from("cvs").upload(path, bytes, {
    upsert: true,
    contentType,
  });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { error } = await supabase.from("candidates").update({ cv_url: path }).eq("id", candidateId);
  if (error) return { ok: false, reason: "upload_failed" };

  return { ok: true };
}

/** Same 15-minute signed-URL pattern already used for employer CV access
 *  in `getApplicantsForJob` (applications.ts). */
export async function getMyCvSignedUrl(): Promise<string | null> {
  const supabase = await createClient();
  const { data: candidate } = await supabase.from("candidates").select("cv_url").maybeSingle();
  if (!candidate?.cv_url) return null;

  const admin = createAdminClient();
  const { data: signed } = await admin.storage.from("cvs").createSignedUrl(candidate.cv_url, 900);
  return signed?.signedUrl ?? null;
}
