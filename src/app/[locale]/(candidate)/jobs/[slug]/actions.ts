"use server";

import { applyToJob, applyAnonymously, type ApplyResult, type AnonymousApplyResult } from "@/lib/db/applications";

export async function applyAction(jobSlug: string, formData: FormData): Promise<ApplyResult> {
  const file = formData.get("cv") as File | null;
  const coverNote = String(formData.get("coverNote") ?? "");
  if (!file || file.size === 0) return { ok: false, reason: "bad_file" };
  return applyToJob(jobSlug, file, coverNote);
}

export async function applyAnonymousAction(jobSlug: string, formData: FormData): Promise<AnonymousApplyResult> {
  const file = formData.get("cv") as File | null;
  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "");
  const coverNote = String(formData.get("coverNote") ?? "");
  if (!file || file.size === 0) return { ok: false, reason: "bad_file" };
  if (!fullName.trim() || !email.trim()) return { ok: false, reason: "db_error" };
  return applyAnonymously(jobSlug, { fullName, email, file, coverNote });
}
