"use server";

import { revalidatePath } from "next/cache";
import { sendMessage, type SendMessageResult } from "@/lib/db/messaging";

export async function sendCandidateMessageAction(threadId: string, body: string): Promise<SendMessageResult> {
  const result = await sendMessage(threadId, body);
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
  return result;
}
