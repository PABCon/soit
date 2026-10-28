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
import { getMyEmployerContext } from "@/lib/db/companies";
import { extractJobFromUrl, type ExtractJobResult } from "@/lib/ai/extract-job";
import { polishJobDescription, type PolishResult } from "@/lib/ai/polish-text";
import { getJobCategories } from "@/lib/db/job-categories";
import { getLocations } from "@/lib/db/locations";
import { requestTechTag } from "@/lib/db/tech-tags";

export async function saveJobAction(jobId: string | null, input: JobFormInput): Promise<SaveResult> {
  return saveJob(jobId, input);
}

// Security audit finding: this and the two actions below call straight
// into a pure `src/lib/ai/*` extraction utility with no session-awareness
// of its own (deliberately — the same function is reused by the console
// form, the bulk importer, and the standalone operator script) — unlike
// every other action in this file, which gets its auth check "for free"
// from the DB-layer function it calls (`saveJob`/`setJobStatus`/
// `deleteJob` all internally call `getMyEmployerContext()`). This one
// genuinely had none: fully unauthenticated, and — since it fetches a
// caller-supplied URL server-side — a real SSRF + free-compute abuse
// vector for anyone on the internet, not just the intended employer
// console user.
export async function extractJobFromUrlAction(url: string): Promise<ExtractJobResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "invalid_url" };
  const [categories, locations] = await Promise.all([getJobCategories(), getLocations()]);
  return extractJobFromUrl(url, {
    categoryLabels: categories.map((c) => c.label),
    locationNames: locations.map((l) => l.name),
  });
}

export async function polishJobDescriptionAction(text: string): Promise<PolishResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "polish_failed" };
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
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "invalid" } as const;
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
  const ctx = await getMyEmployerContext();
  if (!ctx) return [];
  return Promise.all(
    labels.map(async (label) => {
      const result = await requestTechTag(label);
      return { label, tag: result.ok ? result.tag : null };
    }),
  );
}
