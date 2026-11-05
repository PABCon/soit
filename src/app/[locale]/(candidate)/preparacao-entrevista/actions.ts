"use server";

import { requestInterviewPrep, type RequestInterviewPrepResult } from "@/lib/db/interview-prep";

export type { RequestInterviewPrepResult };

export async function requestInterviewPrepAction(
  date: string,
  time: string,
  note: string,
): Promise<RequestInterviewPrepResult> {
  return requestInterviewPrep(date, time, note.trim() || null);
}
