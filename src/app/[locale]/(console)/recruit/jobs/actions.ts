"use server";

import { saveJob, type JobFormInput, type SaveResult } from "@/lib/db/jobs";

export async function saveJobAction(jobId: string | null, input: JobFormInput): Promise<SaveResult> {
  return saveJob(jobId, input);
}
