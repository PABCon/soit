"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sniffFileType } from "@/lib/file-sniff";
import { extractCvText } from "@/lib/cv-text";
import { extractCvProfile, type ExtractedCv } from "@/lib/ai/extract-cv";
import { getTechTags } from "@/lib/db/tech-tags";
import { getSpokenLanguages } from "@/lib/db/spoken-languages";
import { recordSkillSuggestions } from "@/lib/db/skill-suggestions";
import type { SkillLevel } from "@/lib/types";
import {
  updateCandidateProfile,
  uploadCandidateAvatar,
  uploadCandidateCv,
  saveCandidateSkillsAndEducation,
  dismissCvPrompt,
  type UploadResult,
  type SaveSkillsAndEducationInput,
} from "@/lib/db/candidate-profile";

export async function updateProfileAction(formData: FormData) {
  const skills = String(formData.get("skills") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await updateCandidateProfile({
    full_name: String(formData.get("full_name") ?? "").trim(),
    phone: (formData.get("phone") as string)?.trim() || null,
    linkedin_url: (formData.get("linkedin_url") as string)?.trim() || null,
    skills,
  });
  revalidatePath("/profile");
}

export async function uploadAvatarAction(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: true };
  const result = await uploadCandidateAvatar(file);
  if (result.ok) revalidatePath("/profile");
  return result;
}

export async function uploadCvAction(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: true };
  const result = await uploadCandidateCv(file);
  if (result.ok) revalidatePath("/profile");
  return result;
}

// ── CV-upload profile autofill (§AI Pieces backlog, phase 2/3) ──────────────
const MAX_CV_BYTES = 5 * 1024 * 1024; // matches candidate-profile.ts's own cap, §6.7

export type MatchedSkill = { techTagId: string; label: string };
export type MatchedLanguage = { spokenLanguageId: string; label: string; level: SkillLevel | null };

export type ParseCvResult =
  | {
      ok: true;
      data: {
        headline: string | null;
        yearsExperience: number | null;
        matchedSkills: MatchedSkill[];
        unmatchedSkillLabels: string[];
        matchedLanguages: MatchedLanguage[];
        unmatchedLanguageLabels: string[];
        education: ExtractedCv["education"];
      };
    }
  | { ok: false; reason: "not_a_candidate" | "file_too_large" | "bad_file" | "extraction_failed" };

/** Parses an uploaded CV into a structured, fully-editable draft — nothing
 *  is written to the database here (`applyCvExtractionAction` owns that).
 *  Free-text skill/language labels the model returns are fuzzy-matched
 *  here against the real `tech_tags`/`spoken_languages` vocab (same
 *  label/alias match `JobForm.tsx`'s `applyExtractedData()` already uses
 *  in production), but unlike that flow, an unmatched label is *reported*
 *  back rather than silently dropped — a skill on a candidate's own CV
 *  that we don't recognize is worth surfacing, not hiding. */
export async function parseCvAction(formData: FormData): Promise<ParseCvResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0 || file.size > MAX_CV_BYTES) return { ok: false, reason: "file_too_large" };

  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffFileType(bytes);
  if (!kind) return { ok: false, reason: "bad_file" };

  const text = await extractCvText(bytes, kind);
  if (!text) return { ok: false, reason: "bad_file" };

  const result = await extractCvProfile(text);
  if (!result.ok) return { ok: false, reason: result.reason === "empty_content" ? "bad_file" : result.reason };

  const [techTags, spokenLanguages] = await Promise.all([getTechTags(), getSpokenLanguages()]);

  const matchedSkills: MatchedSkill[] = [];
  const unmatchedSkillLabels: string[] = [];
  for (const label of result.data.skillLabels) {
    const norm = label.trim().toLowerCase();
    if (!norm) continue;
    const tag = techTags.find(
      (tg) => tg.label.toLowerCase() === norm || tg.aliases.some((a: string) => a.toLowerCase() === norm),
    );
    if (tag) {
      if (!matchedSkills.some((m) => m.techTagId === tag.id)) matchedSkills.push({ techTagId: tag.id, label: tag.label });
    } else {
      unmatchedSkillLabels.push(label.trim());
    }
  }

  const matchedLanguages: MatchedLanguage[] = [];
  const unmatchedLanguageLabels: string[] = [];
  for (const lang of result.data.languages) {
    const norm = lang.label.trim().toLowerCase();
    if (!norm) continue;
    const spoken = spokenLanguages.find((l) => l.label.toLowerCase() === norm);
    if (spoken) {
      if (!matchedLanguages.some((m) => m.spokenLanguageId === spoken.id)) {
        matchedLanguages.push({ spokenLanguageId: spoken.id, label: spoken.label, level: lang.level });
      }
    } else {
      unmatchedLanguageLabels.push(lang.label.trim());
    }
  }

  // Never blocks the review UI the candidate is waiting on — same pattern
  // as applications.ts's own notification scheduling: try after() first,
  // fall back to fire-and-forget if there's no request scope to schedule in.
  const recordUnmatched = async () => {
    await Promise.all([
      unmatchedSkillLabels.length > 0 ? recordSkillSuggestions(unmatchedSkillLabels, "skill") : Promise.resolve(),
      unmatchedLanguageLabels.length > 0
        ? recordSkillSuggestions(unmatchedLanguageLabels, "language")
        : Promise.resolve(),
    ]);
  };
  try {
    after(recordUnmatched);
  } catch {
    void recordUnmatched();
  }

  return {
    ok: true,
    data: {
      headline: result.data.headline,
      yearsExperience: result.data.yearsExperience,
      matchedSkills,
      unmatchedSkillLabels,
      matchedLanguages,
      unmatchedLanguageLabels,
      education: result.data.education,
    },
  };
}

export async function applyCvExtractionAction(input: SaveSkillsAndEducationInput) {
  await saveCandidateSkillsAndEducation(input);
  revalidatePath("/profile");
}

export async function dismissCvPromptAction() {
  await dismissCvPrompt();
  revalidatePath("/profile");
}
