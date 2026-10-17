"use server";

import { revalidatePath } from "next/cache";
import {
  saveSearch,
  deleteSavedSearch,
  setSavedSearchNotifyOptIn,
  type SearchQuery,
  type SaveSearchResult,
  type SetNotifyOptInResult,
} from "@/lib/db/saved-searches";

export async function saveSearchAction(query: SearchQuery, label: string): Promise<SaveSearchResult> {
  const result = await saveSearch(query, label);
  if (result.ok) revalidatePath("/saved-searches");
  return result;
}

export async function deleteSavedSearchAction(id: string): Promise<void> {
  await deleteSavedSearch(id);
  revalidatePath("/saved-searches");
}

export async function setSavedSearchNotifyOptInAction(id: string, optIn: boolean): Promise<SetNotifyOptInResult> {
  const result = await setSavedSearchNotifyOptIn(id, optIn);
  if (result.ok) revalidatePath("/saved-searches");
  return result;
}
