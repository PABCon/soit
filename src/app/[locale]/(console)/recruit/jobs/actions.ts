"use server";

import { revalidatePath } from "next/cache";
import {
  saveJob,
  setJobStatus,
  deleteJob,
  type JobFormInput,
  type SaveResult,
  type SetStatusResult,
} from "@/lib/db/jobs";
import { extractJobFromUrl, type ExtractJobResult } from "@/lib/ai/extract-job";
import { polishJobDescription, type PolishResult } from "@/lib/ai/polish-text";
import { getJobCategories } from "@/lib/db/job-categories";
import { getLocations } from "@/lib/db/locations";

export async function saveJobAction(jobId: string | null, input: JobFormInput): Promise<SaveResult> {
  return saveJob(jobId, input);
}

export async function extractJobFromUrlAction(url: string): Promise<ExtractJobResult> {
  const [categories, locations] = await Promise.all([getJobCategories(), getLocations()]);
  return extractJobFromUrl(url, {
    categoryLabels: categories.map((c) => c.label),
    locationNames: locations.map((l) => l.name),
  });
}

export async function polishJobDescriptionAction(text: string): Promise<PolishResult> {
  return polishJobDescription(text);
}

export async function setJobStatusAction(
  jobId: string,
  status: "inactive" | "published",
): Promise<SetStatusResult> {
  const result = await setJobStatus(jobId, status);
  revalidatePath("/recruit");
  return result;
}

export async function deleteJobAction(jobId: string) {
  await deleteJob(jobId);
  revalidatePath("/recruit");
}
