import { createAdminClient } from "@/lib/supabase/admin";

export type SkillSuggestionKind = "skill" | "language";

/** Records a CV-parse label that didn't match the real `tech_tags`/
 *  `spoken_languages` vocab, incrementing an occurrence count on repeat —
 *  seed data for a future admin panel's "review pending tags" screen
 *  (§ go-live checklist). Best-effort: a low-stakes counter, so a race
 *  under concurrent writes (occasional undercounting) is fine — not worth
 *  an atomic RPC for this. Always goes through the admin client; no
 *  candidate-facing RLS policy exists on this table at all. */
export async function recordSkillSuggestion(label: string, kind: SkillSuggestionKind): Promise<void> {
  const norm = label.trim().toLowerCase();
  if (!norm) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("skill_suggestions")
    .select("id, occurrences")
    .eq("label_norm", norm)
    .eq("kind", kind)
    .maybeSingle();

  if (existing) {
    await admin
      .from("skill_suggestions")
      .update({ occurrences: existing.occurrences + 1, last_seen_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await admin.from("skill_suggestions").insert({ label: label.trim(), kind });
  }
}

export async function recordSkillSuggestions(labels: string[], kind: SkillSuggestionKind): Promise<void> {
  await Promise.all(labels.map((label) => recordSkillSuggestion(label, kind)));
}
