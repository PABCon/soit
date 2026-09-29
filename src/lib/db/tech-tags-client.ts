"use client";

import { createClient } from "@/lib/supabase/client";

/** Client-side counterpart to `getTechTags()`/`getSpokenLanguages()`
 *  (server-only, since they use the cookie-based server client) — both
 *  tables are public-readable via RLS, so a plain browser client can query
 *  them directly. Only needed by `CvOnboardingPrompt`, which renders before
 *  any server page has had a chance to pass this vocab down as props. */
export async function getVocabClient() {
  const supabase = createClient();
  const [{ data: techTags }, { data: spokenLanguages }] = await Promise.all([
    supabase.from("tech_tags").select("id, label, aliases").order("label"),
    supabase.from("spoken_languages").select("id, slug, label").order("label"),
  ]);
  return {
    techTags: techTags ?? [],
    spokenLanguages: spokenLanguages ?? [],
  };
}
