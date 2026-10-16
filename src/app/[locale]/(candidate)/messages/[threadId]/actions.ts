"use server";

import { revalidatePath } from "next/cache";
import { sendMessage, type SendMessageResult } from "@/lib/db/messaging";

export async function sendCandidateMessageAction(threadId: string, body: string, file: File | null): Promise<SendMessageResult> {
  const result = await sendMessage(threadId, body, file);
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
  return result;
}
