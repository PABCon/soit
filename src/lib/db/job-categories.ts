import { createClient } from "@/lib/supabase/server";

export type JobCategoryOption = { id: string; slug: string; label: string };

export async function getJobCategories(): Promise<JobCategoryOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("job_categories").select("id, slug, label").order("label");
  return data ?? [];
}
