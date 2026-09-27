"use server";

import { revalidatePath } from "next/cache";
import { toggleFavorite } from "@/lib/db/favorites";

export async function toggleFavoriteAction(jobId: string): Promise<{ favorited: boolean }> {
  const result = await toggleFavorite(jobId);
  revalidatePath("/favorites");
  return result;
}
