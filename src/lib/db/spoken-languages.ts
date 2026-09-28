import { createClient } from "@/lib/supabase/server";

export type SpokenLanguageOption = { id: string; slug: string; label: string };

/** Working languages a job can require (§ real-usage QA, item 11) —
 *  distinct from `jobs.language`, which is just the ad's own PT/EN text
 *  language. Same tiny-curated-table shape as `locations`/`job_categories`. */
export async function getSpokenLanguages(): Promise<SpokenLanguageOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("spoken_languages").select("id, slug, label").order("label");
  return data ?? [];
}
