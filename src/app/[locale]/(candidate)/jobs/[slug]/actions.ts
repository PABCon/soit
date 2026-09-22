"use server";

import { applyToJob, type ApplyResult } from "@/lib/db/applications";

export async function applyAction(jobSlug: string, formData: FormData): Promise<ApplyResult> {
  const file = formData.get("cv") as File | null;
  const coverNote = String(formData.get("coverNote") ?? "");
  if (!file || file.size === 0) return { ok: false, reason: "bad_file" };
  return applyToJob(jobSlug, file, coverNote);
}
