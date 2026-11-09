"use server";

import { revalidatePath } from "next/cache";
import {
  addCompanyStage,
  renameCompanyStage,
  deleteCompanyStage,
  reorderCompanyStages,
  type AddStageResult,
  type CandidateBucket,
  type StageMutationResult,
} from "@/lib/db/application-stages";

function revalidatePipelineConsumers() {
  revalidatePath("/recruit/pipeline");
  revalidatePath("/recruit/applicants");
}

export async function addStageAction(label: string, candidateBucket: CandidateBucket): Promise<AddStageResult> {
  const result = await addCompanyStage(label, candidateBucket);
  if (result.ok) revalidatePipelineConsumers();
  return result;
}

export async function renameStageAction(
  stageId: string,
  label: string,
  candidateBucket: CandidateBucket,
): Promise<StageMutationResult> {
  const result = await renameCompanyStage(stageId, label, candidateBucket);
  if (result.ok) revalidatePipelineConsumers();
  return result;
}

export async function deleteStageAction(stageId: string): Promise<StageMutationResult> {
  const result = await deleteCompanyStage(stageId);
  if (result.ok) revalidatePipelineConsumers();
  return result;
}

export async function reorderStagesAction(orderedStageIds: string[]): Promise<StageMutationResult> {
  const result = await reorderCompanyStages(orderedStageIds);
  if (result.ok) revalidatePipelineConsumers();
  return result;
}
