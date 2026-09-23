import { createClient } from "@/lib/supabase/server";

export async function getTechTags() {
  const supabase = await createClient();
  const { data } = await supabase.from("tech_tags").select("id, slug, label, aliases").order("label");
  return data ?? [];
}
