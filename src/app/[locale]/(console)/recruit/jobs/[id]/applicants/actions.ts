"use server";

import { revalidatePath } from "next/cache";
import { updateApplicationStatus, type MyApplication } from "@/lib/db/applications";

export async function updateStatusAction(jobId: string, applicationId: string, status: MyApplication["status"]) {
  await updateApplicationStatus(applicationId, status);
  revalidatePath(`/recruit/jobs/${jobId}/applicants`);
}
