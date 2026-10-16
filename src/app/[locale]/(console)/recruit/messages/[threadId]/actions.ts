"use server";

import { revalidatePath } from "next/cache";
import { sendMessage, type SendMessageResult } from "@/lib/db/messaging";

export async function sendEmployerMessageAction(threadId: string, body: string, file: File | null): Promise<SendMessageResult> {
  const result = await sendMessage(threadId, body, file);
  revalidatePath(`/recruit/messages/${threadId}`);
  revalidatePath("/recruit/messages");
  return result;
}
