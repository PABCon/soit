"use server";

import { getOrCreateThreadForMatch, type StartThreadResult } from "@/lib/db/messaging";

export async function startMatchThreadAction(candidateId: string, jobId: string, body: string): Promise<StartThreadResult> {
  return getOrCreateThreadForMatch(candidateId, jobId, body);
}
