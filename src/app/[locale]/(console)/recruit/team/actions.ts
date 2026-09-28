"use server";

import { revalidatePath } from "next/cache";
import { createInvite, removeMember, deleteInvite, resendInvite } from "@/lib/db/team";

export async function createInviteAction(email: string, role: "owner" | "member") {
  const token = await createInvite(email, role);
  revalidatePath("/recruit/team");
  return token;
}

export async function removeMemberAction(memberId: string) {
  await removeMember(memberId);
  revalidatePath("/recruit/team");
}

export async function deleteInviteAction(inviteId: string) {
  await deleteInvite(inviteId);
  revalidatePath("/recruit/team");
}

export async function resendInviteAction(inviteId: string) {
  const token = await resendInvite(inviteId);
  revalidatePath("/recruit/team");
  return token;
}
