import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getMyEmployerContext } from "./companies";

export type TeamMember = {
  id: string;
  role: "owner" | "member";
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: "owner" | "member";
  token: string;
  expiresAt: string;
};

/** employer_users carries no email — the one legitimate use of the admin
 *  client in this step, to join it in for display. */
export async function getCompanyMembers(companyId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: rows } = await supabase
    .from("employer_users")
    .select("id, auth_user_id, role, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (!rows) return [];

  return Promise.all(
    rows.map(async (row) => {
      const { data } = await admin.auth.admin.getUserById(row.auth_user_id);
      const metadata = data.user?.user_metadata as { full_name?: string; avatar_url?: string } | undefined;
      return {
        id: row.id,
        role: row.role,
        email: data.user?.email ?? "—",
        fullName: metadata?.full_name || null,
        avatarUrl: metadata?.avatar_url || null,
        createdAt: row.created_at,
      };
    }),
  );
}

/** Self-service — Supabase Auth's own user record, not a table
 *  `employer_users` owns, so no new RLS grant is needed (same as
 *  `last_role`/`pending_nif`, already set the same way at signup). */
export async function updateMyMemberProfile(fields: { full_name: string; avatar_url?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: fields });
  if (error) throw new Error(error.message);
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type UploadResult =
  | { ok: true }
  | { ok: false; reason: "no_session" | "file_too_large" | "bad_file" | "upload_failed" };

/** Same shared `avatars` bucket and structured-result shape as
 *  `uploadCandidateAvatar` (candidate-profile.ts) — the only difference is
 *  where the resulting URL is written (user_metadata, not a table column). */
export async function uploadMemberAvatar(file: File): Promise<UploadResult> {
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, reason: "file_too_large" };
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return { ok: false, reason: "bad_file" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "no_session" };

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error } = await supabase.auth.updateUser({
    data: { avatar_url: `${publicUrl.publicUrl}?v=${Date.now()}` },
  });
  if (error) return { ok: false, reason: "upload_failed" };

  return { ok: true };
}

export async function getPendingInvites(companyId: string): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employer_invites")
    .select("id, email, role, token, expires_at")
    .eq("company_id", companyId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    token: r.token,
    expiresAt: r.expires_at,
  }));
}

export async function createInvite(email: string, role: "owner" | "member") {
  const ctx = await getMyEmployerContext();
  if (!ctx || ctx.role !== "owner") throw new Error("Owners only");

  const supabase = await createClient();
  const token = crypto.randomUUID();
  const { error } = await supabase.from("employer_invites").insert({
    company_id: ctx.company.id,
    email: email.toLowerCase(),
    role,
    token,
    invited_by: ctx.employerId,
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });
  if (error) throw new Error(error.message);
  return token;
}

/** Owner-only, and never removes the company's last owner (§5.1 — the
 *  schema comment: a constraint here would block the first insert, so this
 *  rule lives in application code instead). */
export async function removeMember(memberId: string) {
  const ctx = await getMyEmployerContext();
  if (!ctx || ctx.role !== "owner") throw new Error("Owners only");

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("employer_users")
    .select("id, role")
    .eq("company_id", ctx.company.id);

  const target = members?.find((m) => m.id === memberId);
  if (!target) throw new Error("Not found");

  const ownerCount = members!.filter((m) => m.role === "owner").length;
  if (target.role === "owner" && ownerCount <= 1) {
    throw new Error("A company must keep at least one owner");
  }

  const { error } = await supabase.from("employer_users").delete().eq("id", memberId);
  if (error) throw new Error(error.message);
}

/** Public: the invitee has no session yet, so this can't go through RLS. */
export async function getInviteByToken(token: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("employer_invites")
    .select("email, role, expires_at, accepted_at, companies(company_name)")
    .eq("token", token)
    .maybeSingle();

  if (!data || data.accepted_at || new Date(data.expires_at) < new Date()) return null;

  return {
    email: data.email,
    role: data.role as "owner" | "member",
    companyName: (data.companies as unknown as { company_name: string } | null)?.company_name ?? "",
  };
}
