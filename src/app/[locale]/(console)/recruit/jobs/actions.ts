"use server";

import { revalidatePath } from "next/cache";
import { saveJob, setJobStatus, deleteJob, type JobFormInput, type SaveResult } from "@/lib/db/jobs";
import { extractJobFromUrl, type ExtractJobResult } from "@/lib/ai/extract-job";

export async function saveJobAction(jobId: string | null, input: JobFormInput): Promise<SaveResult> {
  return saveJob(jobId, input);
}

export async function extractJobFromUrlAction(url: string): Promise<ExtractJobResult> {
  return extractJobFromUrl(url);
}

export async function setJobStatusAction(jobId: string, status: "inactive" | "published") {
  await setJobStatus(jobId, status);
  revalidatePath("/recruit");
}

export async function deleteJobAction(jobId: string) {
  await deleteJob(jobId);
  revalidatePath("/recruit");
}
