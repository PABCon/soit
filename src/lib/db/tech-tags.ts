import { createClient } from "@/lib/supabase/server";

export async function getTechTags() {
  const supabase = await createClient();
  const { data } = await supabase.from("tech_tags").select("id, slug, label, aliases").order("label");
  return data ?? [];
}

export type FeaturedTechCount = { slug: string; label: string; group: "language" | "technology"; count: number };

/** Powers the "Browse by language"/"Browse by technology" sections on
 *  `/jobs` — a small curated subset of `tech_tags` (§ real-usage QA: "most
 *  common ones, don't overwhelm people"), counted only among currently
 *  live jobs, same "never advertise an empty link" rule as location/
 *  category. Small dataset (20 featured tags, few live jobs today) — one
 *  query, aggregated in memory, not 20 per-tag count queries. */
export async function getFeaturedTechCounts(): Promise<FeaturedTechCount[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_tech_tags")
    .select("tech_tags!inner(slug, label, featured_group), jobs!inner(status, expires_at)")
    .eq("jobs.status", "published")
    .gt("jobs.expires_at", new Date().toISOString());

  const counts = new Map<string, FeaturedTechCount>();
  for (const row of (data ?? []) as unknown as {
    tech_tags: { slug: string; label: string; featured_group: "language" | "technology" | null };
  }[]) {
    const tag = row.tech_tags;
    if (!tag.featured_group) continue;
    const existing = counts.get(tag.slug);
    if (existing) existing.count += 1;
    else counts.set(tag.slug, { slug: tag.slug, label: tag.label, group: tag.featured_group, count: 1 });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
