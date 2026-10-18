import { createClient } from "@/lib/supabase/server";

export type LocationOption = {
  id: string;
  slug: string;
  name: string;
  /** "Portugal" for the original seeded cities, a real country name for
   *  the European-hub expansion (§ job-location expansion) — lets a picker
   *  group/label the two sets, e.g. "Portugal" vs "Other Europe". Purely a
   *  display/grouping fact, not a new taxonomy of its own. */
  country: string;
  /** For the "near X within Y km" search (§7.1 phase 5) — a plain
   *  client-side Haversine calc over the already-fetched job list, since
   *  every curated location already has fixed coordinates (no geocoding
   *  provider needed). Unused by callers that only need the picker. */
  latitude: number;
  longitude: number;
};

export async function getLocations(): Promise<LocationOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("id, slug, name, country, latitude, longitude")
    .order("name");
  return data ?? [];
}
