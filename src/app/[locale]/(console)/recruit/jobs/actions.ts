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
import { requestTechTag } from "@/lib/db/tech-tags";

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

export async function requestTechTagAction(label: string) {
  return requestTechTag(label);
}

/** §job-import — the single-URL "paste a link" autofill used to silently
 *  drop any tech-stack label that didn't already match the real
 *  vocabulary (a real gap: "VBA" isn't in tech_tags at all, and genuinely
 *  common skills a hand-curated list will keep missing). This resolves
 *  every such label through the same auto-approve pipeline the bulk
 *  importer uses, in parallel since each is an independent LLM call. */
export async function resolveUnmatchedTechLabelsAction(
  labels: string[],
): Promise<{ label: string; tag: { id: string; label: string; aliases: string[] } | null }[]> {
  return Promise.all(
    labels.map(async (label) => {
      const result = await requestTechTag(label);
      return { label, tag: result.ok ? result.tag : null };
    }),
  );
}
