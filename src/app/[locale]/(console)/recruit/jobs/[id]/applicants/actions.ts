"use server";

import { revalidatePath } from "next/cache";
import {
  updateApplicationStatus,
  generateApplicantSynopsisForApplication,
  type MyApplication,
  type GenerateSynopsisResult,
} from "@/lib/db/applications";
import { getOrCreateThreadForApplicant, getOrCreateThreadIdForApplicant, type StartThreadResult } from "@/lib/db/messaging";

export async function updateStatusAction(jobId: string, applicationId: string, status: MyApplication["status"]) {
  await updateApplicationStatus(applicationId, status);
  revalidatePath(`/recruit/jobs/${jobId}/applicants`);
}

export async function startApplicantThreadAction(applicationId: string, body: string): Promise<StartThreadResult> {
  return getOrCreateThreadForApplicant(applicationId, body);
}

/** `/recruit/applicants`'s "Message" button — navigates straight to the
 *  real thread page rather than showing an inline compose box first. */
export async function openApplicantThreadAction(applicationId: string): Promise<StartThreadResult> {
  return getOrCreateThreadIdForApplicant(applicationId);
}

export async function generateApplicantSynopsisAction(applicationId: string): Promise<GenerateSynopsisResult> {
  const result = await generateApplicantSynopsisForApplication(applicationId);
  revalidatePath(`/recruit/applicants/${applicationId}`);
  return result;
}
