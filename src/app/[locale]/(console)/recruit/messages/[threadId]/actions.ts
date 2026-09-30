"use server";

import { revalidatePath } from "next/cache";
import { sendMessage, type SendMessageResult } from "@/lib/db/messaging";

export async function sendEmployerMessageAction(threadId: string, body: string): Promise<SendMessageResult> {
  const result = await sendMessage(threadId, body);
  revalidatePath(`/recruit/messages/${threadId}`);
  revalidatePath("/recruit/messages");
  return result;
}
