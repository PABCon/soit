"use server";

import { updateMarketingOptIn, deleteCandidateAccount, type DeleteAccountResult } from "@/lib/db/candidate-profile";

export async function updateMarketingOptInAction(optIn: boolean): Promise<void> {
  await updateMarketingOptIn(optIn);
}

export async function deleteCandidateAccountAction(): Promise<DeleteAccountResult> {
  return deleteCandidateAccount();
}
