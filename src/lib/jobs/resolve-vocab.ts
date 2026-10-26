import { findMatchingTechTag, resolveTechTagLabel, type TechTagOption } from "@/lib/db/tech-tags";
import type { ExtractedJob } from "@/lib/ai/extract-job";
import type { SkillLevel } from "@/lib/types";

export type VocabLists = {
  techTags: TechTagOption[];
  jobCategories: { id: string; label: string }[];
  spokenLanguages: { id: string; label: string }[];
};

export type ResolvedJobVocab = {
  categoryId: string | null;
  techTags: { techTagId: string; level: SkillLevel | null; required: boolean }[];
  languages: { spokenLanguageId: string; level: SkillLevel | null }[];
};

/**
 * §job-import — server-side counterpart to JobForm's client-side
 * applyExtractedData: resolves an extraction's category/tech-stack/
 * required-language labels against the real vocabulary for a context
 * with no browser/session (the bulk importer). An unmatched tech label
 * goes through the same auto-approve-or-reject pipeline the single-URL
 * autofill and the manual "request a tag" button use
 * (resolveTechTagLabel) — never silently dropped. Category/language
 * matching stays exact-only (no auto-creation for those taxonomies —
 * see the migration's own comment for why that's deliberately scoped to
 * tech tags only).
 *
 * Resolves one job's own unmatched tech labels in parallel (each is an
 * independent LLM call) to keep a single job's contribution to a batch's
 * wall-clock time bounded — this function still runs once per job,
 * sequentially across a batch, by its caller.
 */
export async function resolveExtractedJobVocab(
  data: ExtractedJob,
  vocab: VocabLists,
  companyId: string,
  companyName: string,
): Promise<ResolvedJobVocab> {
  let categoryId: string | null = null;
  if (data.categoryLabel) {
    const norm = data.categoryLabel.trim().toLowerCase();
    const category = vocab.jobCategories.find((c) => c.label.toLowerCase() === norm);
    if (category) categoryId = category.id;
  }

  const alreadyMatched: { entry: ExtractedJob["techStack"][number]; tag: TechTagOption }[] = [];
  const unmatched: ExtractedJob["techStack"] = [];
  for (const entry of data.techStack) {
    const tag = findMatchingTechTag(entry.label, vocab.techTags);
    if (tag) alreadyMatched.push({ entry, tag });
    else unmatched.push(entry);
  }

  const resolvedUnmatched = await Promise.all(
    unmatched.map(async (entry) => {
      const result = await resolveTechTagLabel(entry.label, companyId, companyName);
      return result.ok ? { entry, tag: result.tag } : null;
    }),
  );
  for (const r of resolvedUnmatched) {
    if (r && !vocab.techTags.some((t) => t.id === r.tag.id)) vocab.techTags.push(r.tag);
  }

  const techTagResults: { techTagId: string; level: SkillLevel | null; required: boolean }[] = [];
  for (const { entry, tag } of [...alreadyMatched, ...resolvedUnmatched.filter((r): r is NonNullable<typeof r> => r !== null)]) {
    if (!techTagResults.some((t) => t.techTagId === tag.id)) {
      techTagResults.push({ techTagId: tag.id, level: entry.level, required: entry.required });
    }
  }

  const languageResults: { spokenLanguageId: string; level: SkillLevel | null }[] = [];
  for (const rl of data.requiredLanguages) {
    const norm = rl.label.trim().toLowerCase();
    const lang = vocab.spokenLanguages.find((l) => l.label.toLowerCase() === norm);
    if (lang && !languageResults.some((l) => l.spokenLanguageId === lang.id)) {
      languageResults.push({ spokenLanguageId: lang.id, level: rl.level });
    }
  }

  return { categoryId, techTags: techTagResults, languages: languageResults };
}
