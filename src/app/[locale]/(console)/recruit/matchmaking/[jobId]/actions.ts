"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateThreadForMatch, type StartThreadResult } from "@/lib/db/messaging";
import {
  setMatchStatus,
  regenerateMatchSummary,
  type MatchStatus,
  type SetMatchStatusResult,
  type RegenerateMatchSummaryResult,
} from "@/lib/db/candidate-matches";

export async function startMatchThreadAction(candidateId: string, jobId: string, body: string): Promise<StartThreadResult> {
  return getOrCreateThreadForMatch(candidateId, jobId, body);
}

export async function setMatchStatusAction(jobId: string, candidateId: string, status: MatchStatus): Promise<SetMatchStatusResult> {
  const result = await setMatchStatus(jobId, candidateId, status);
  revalidatePath(`/recruit/matchmaking/${jobId}`);
  revalidatePath(`/recruit/matchmaking/${jobId}/${candidateId}`);
  return result;
}

export async function regenerateMatchSummaryAction(jobId: string, candidateId: string): Promise<RegenerateMatchSummaryResult> {
  const result = await regenerateMatchSummary(jobId, candidateId);
  revalidatePath(`/recruit/matchmaking/${jobId}/${candidateId}`);
  return result;
}
