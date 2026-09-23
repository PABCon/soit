import { createClient } from "@/lib/supabase/server";

export type LocationOption = { id: string; slug: string; name: string };

export async function getLocations(): Promise<LocationOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id, slug, name").order("name");
  return data ?? [];
}
