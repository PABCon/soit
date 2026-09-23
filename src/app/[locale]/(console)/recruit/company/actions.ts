"use server";

import { createClient } from "@/lib/supabase/server";
import { updateCompanyProfile, updateCompanyImage } from "@/lib/db/companies";
import { revalidatePath } from "next/cache";

function trimmedOrNull(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null;
}

export async function updateProfileAction(formData: FormData) {
  await updateCompanyProfile({
    company_name: String(formData.get("company_name") ?? "").trim(),
    company_description: trimmedOrNull(formData, "company_description"),
    website: trimmedOrNull(formData, "website"),
    industry: trimmedOrNull(formData, "industry"),
    company_size: trimmedOrNull(formData, "company_size"),
    company_type: trimmedOrNull(formData, "company_type"),
    facebook_url: trimmedOrNull(formData, "facebook_url"),
    linkedin_url: trimmedOrNull(formData, "linkedin_url"),
    instagram_url: trimmedOrNull(formData, "instagram_url"),
    youtube_url: trimmedOrNull(formData, "youtube_url"),
    tiktok_url: trimmedOrNull(formData, "tiktok_url"),
    x_url: trimmedOrNull(formData, "x_url"),
  });
  revalidatePath("/recruit/company");

  const supabase = await createClient();
  const { data: company } = await supabase.rpc("my_company");
  if (company?.slug) {
    revalidatePath(`/companies/${company.slug}`);
    revalidatePath("/companies");
  }
}

// Must match the `branding` bucket's own limits (supabase/migrations/
// 20260921120200_storage.sql) — checked here too so a bad upload gets a
// specific, translated reason instead of a raw Storage error string.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export type UploadImageResult =
  | { ok: true }
  | { ok: false; reason: "not_employer" | "file_too_large" | "bad_file" | "upload_failed" };

export async function uploadImageAction(
  field: "logo" | "cover",
  formData: FormData,
): Promise<UploadImageResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: true };

  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "file_too_large" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, reason: "bad_file" };

  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) return { ok: false, reason: "not_employer" };

  const ext = file.name.split(".").pop() || "png";
  const path = `${companyId}/${field}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { data: publicUrl } = supabase.storage.from("branding").getPublicUrl(path);

  try {
    await updateCompanyImage(
      field === "logo" ? "company_logo_url" : "cover_image_url",
      // Cache-bust so a re-upload at the same path shows immediately.
      `${publicUrl.publicUrl}?v=${Date.now()}`,
    );
  } catch {
    return { ok: false, reason: "upload_failed" };
  }
  revalidatePath("/recruit/company");
  return { ok: true };
}
