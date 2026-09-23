"use server";

import { revalidatePath } from "next/cache";
import { updateMyMemberProfile, uploadMemberAvatar, type UploadResult } from "@/lib/db/team";

export async function updateMyProfileAction(formData: FormData) {
  await updateMyMemberProfile({
    full_name: String(formData.get("full_name") ?? "").trim(),
  });
  revalidatePath("/recruit/settings");
  revalidatePath("/recruit/team");
}

export async function uploadMyAvatarAction(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: true };
  const result = await uploadMemberAvatar(file);
  if (result.ok) {
    revalidatePath("/recruit/settings");
    revalidatePath("/recruit/team");
  }
  return result;
}
