"use server";

import { generateApiKey, revokeApiKey } from "@/lib/db/api-keys";

export async function generateApiKeyAction() {
  return generateApiKey();
}

export async function revokeApiKeyAction(keyId: string) {
  await revokeApiKey(keyId);
}
