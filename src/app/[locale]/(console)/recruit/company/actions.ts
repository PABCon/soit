"use server";

import { createClient } from "@/lib/supabase/server";
import { updateCompanyProfile, updateCompanyImage } from "@/lib/db/companies";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(formData: FormData) {
  await updateCompanyProfile({
    company_name: String(formData.get("company_name") ?? "").trim(),
    company_description: (formData.get("company_description") as string)?.trim() || null,
    website: (formData.get("website") as string)?.trim() || null,
    industry: (formData.get("industry") as string)?.trim() || null,
    company_size: (formData.get("company_size") as string)?.trim() || null,
  });
  revalidatePath("/recruit/company");
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
