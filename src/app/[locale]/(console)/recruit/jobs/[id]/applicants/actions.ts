"use server";

import { revalidatePath } from "next/cache";
import { updateApplicationStatus, type MyApplication } from "@/lib/db/applications";
import { getOrCreateThreadForApplicant, type StartThreadResult } from "@/lib/db/messaging";

export async function updateStatusAction(jobId: string, applicationId: string, status: MyApplication["status"]) {
  await updateApplicationStatus(applicationId, status);
  revalidatePath(`/recruit/jobs/${jobId}/applicants`);
}

export async function startApplicantThreadAction(applicationId: string, body: string): Promise<StartThreadResult> {
  return getOrCreateThreadForApplicant(applicationId, body);
}
