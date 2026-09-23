"use server";

import { revalidatePath } from "next/cache";
import { saveJob, setJobStatus, deleteJob, type JobFormInput, type SaveResult } from "@/lib/db/jobs";

export async function saveJobAction(jobId: string | null, input: JobFormInput): Promise<SaveResult> {
  return saveJob(jobId, input);
}

export async function setJobStatusAction(jobId: string, status: "inactive" | "published") {
  await setJobStatus(jobId, status);
  revalidatePath("/recruit");
}

export async function deleteJobAction(jobId: string) {
  await deleteJob(jobId);
  revalidatePath("/recruit");
}
