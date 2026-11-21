"use server";

import { updateMarketingOptIn, deleteCandidateAccount, type DeleteAccountResult } from "@/lib/db/candidate-profile";
import { getMyDataExport } from "@/lib/db/data-export";
import { generateCandidateApiKey, revokeCandidateApiKey } from "@/lib/db/candidate-api-keys";

export async function updateMarketingOptInAction(optIn: boolean): Promise<void> {
  await updateMarketingOptIn(optIn);
}

export async function deleteCandidateAccountAction(): Promise<DeleteAccountResult> {
  return deleteCandidateAccount();
}

export async function exportMyDataAction() {
  return getMyDataExport();
}

export async function generateCandidateApiKeyAction() {
  return generateCandidateApiKey();
}

export async function revokeCandidateApiKeyAction(keyId: string) {
  await revokeCandidateApiKey(keyId);
}
