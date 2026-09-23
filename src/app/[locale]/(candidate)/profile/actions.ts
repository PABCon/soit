"use server";

import { revalidatePath } from "next/cache";
import {
  updateCandidateProfile,
  uploadCandidateAvatar,
  uploadCandidateCv,
  type UploadResult,
} from "@/lib/db/candidate-profile";

export async function updateProfileAction(formData: FormData) {
  const skills = String(formData.get("skills") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await updateCandidateProfile({
    full_name: String(formData.get("full_name") ?? "").trim(),
    phone: (formData.get("phone") as string)?.trim() || null,
    linkedin_url: (formData.get("linkedin_url") as string)?.trim() || null,
    skills,
  });
  revalidatePath("/profile");
}

export async function uploadAvatarAction(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: true };
  const result = await uploadCandidateAvatar(file);
  if (result.ok) revalidatePath("/profile");
  return result;
}

export async function uploadCvAction(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: true };
  const result = await uploadCandidateCv(file);
  if (result.ok) revalidatePath("/profile");
  return result;
}
