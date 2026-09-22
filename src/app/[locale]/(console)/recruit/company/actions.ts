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

export async function uploadImageAction(field: "logo" | "cover", formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) throw new Error("Not an employer");

  const ext = file.name.split(".").pop() || "png";
  const path = `${companyId}/${field}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrl } = supabase.storage.from("branding").getPublicUrl(path);

  await updateCompanyImage(
    field === "logo" ? "company_logo_url" : "cover_image_url",
    // Cache-bust so a re-upload at the same path shows immediately.
    `${publicUrl.publicUrl}?v=${Date.now()}`,
  );
  revalidatePath("/recruit/company");
}
