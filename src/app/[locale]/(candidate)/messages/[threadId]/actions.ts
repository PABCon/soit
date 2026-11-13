"use server";

import { revalidatePath } from "next/cache";
import {
  sendMessage,
  respondToConnectionRequest,
  type SendMessageResult,
  type RespondToConnectionRequestResult,
} from "@/lib/db/messaging";

export async function sendCandidateMessageAction(threadId: string, body: string, file: File | null): Promise<SendMessageResult> {
  const result = await sendMessage(threadId, body, file);
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
  return result;
}

export async function respondToConnectionRequestAction(
  threadId: string,
  decision: "accepted" | "declined",
): Promise<RespondToConnectionRequestResult> {
  const result = await respondToConnectionRequest(threadId, decision);
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
  return result;
}
