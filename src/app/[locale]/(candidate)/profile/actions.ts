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
import type { SniffedType } from "@/lib/file-sniff";
import {
  updateCandidateProfile,
  uploadCandidateAvatar,
  uploadCandidateCv,
  getMyCvSignedUrl,
  downloadMyCv,
  saveCandidateBasics,
  saveCandidateSkills,
  saveCandidateLanguages,
  saveCandidateEducation,
  saveCandidateCertifications,
  saveCandidateExperience,
  saveCandidateJobPreferences,
  dismissCvPrompt,
  type UploadResult,
  type CandidateEducationInput,
  type CandidateCertificationInput,
  type CandidateExperienceInput,
  type CandidateJobPreferences,
} from "@/lib/db/candidate-profile";

export async function updateCandidateProfileAction(fields: {
  full_name: string;
  phone: string | null;
  linkedin_url: string | null;
}) {
  await updateCandidateProfile(fields);
  revalidatePath("/profile");
}

// ── Per-section profile editing (§AI Pieces backlog, profile-depth phase) ───
// One action per section, mirroring the granular save functions — editing
// one section (e.g. Experience) can never touch another's data.

export async function saveCandidateBasicsAction(headline: string | null, yearsExperience: number | null) {
  await saveCandidateBasics(headline, yearsExperience);
  revalidatePath("/profile");
}

export async function saveCandidateSkillsAction(entries: { techTagId: string; level: SkillLevel | null }[]) {
  await saveCandidateSkills(entries);
  revalidatePath("/profile");
}

export async function saveCandidateLanguagesAction(
  entries: { spokenLanguageId: string; level: SkillLevel | null }[],
) {
  await saveCandidateLanguages(entries);
  revalidatePath("/profile");
}

export async function saveCandidateEducationAction(entries: CandidateEducationInput[]) {
  await saveCandidateEducation(entries);
  revalidatePath("/profile");
}

export async function saveCandidateCertificationsAction(entries: CandidateCertificationInput[]) {
  await saveCandidateCertifications(entries);
  revalidatePath("/profile");
}

export async function saveCandidateExperienceAction(entries: CandidateExperienceInput[]) {
  await saveCandidateExperience(entries);
  revalidatePath("/profile");
}

export async function saveCandidateJobPreferencesAction(input: CandidateJobPreferences) {
  await saveCandidateJobPreferences(input);
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

/** Lets `OverviewSection` refresh its CV preview/download link right
 *  after "Analyze my CV" stores the file, without a full page reload —
 *  a reload would discard the AI draft now sitting in client state
 *  (§AI Pieces backlog, profile-depth phase 3). */
export async function getCvSignedUrlAction(): Promise<string | null> {
  return getMyCvSignedUrl();
}

// ── CV-upload profile autofill (§AI Pieces backlog, phase 2/3) ──────────────
const MAX_CV_BYTES = 5 * 1024 * 1024; // matches candidate-profile.ts's own cap, §6.7

export type MatchedSkill = { techTagId: string; label: string };
export type MatchedLanguage = { spokenLanguageId: string; label: string; level: SkillLevel | null };

export type ParseCvResult =
  | {
      ok: true;
      data: {
        fullName: string | null;
        phone: string | null;
        linkedinUrl: string | null;
        headline: string | null;
        yearsExperience: number | null;
        matchedSkills: MatchedSkill[];
        unmatchedSkillLabels: string[];
        matchedLanguages: MatchedLanguage[];
        unmatchedLanguageLabels: string[];
        education: ExtractedCv["education"];
        experience: ExtractedCv["experience"];
        certifications: ExtractedCv["certifications"];
      };
    }
  | { ok: false; reason: "not_a_candidate" | "file_too_large" | "bad_file" | "extraction_failed" };

/** Shared by both entry points below (fresh upload vs. re-analyzing the
 *  file already on record) — everything past "we have bytes + a sniffed
 *  kind" is identical: extract text, run the LLM, fuzzy-match skills/
 *  languages against the real vocab, record unmatched labels. */
async function runCvExtraction(bytes: Uint8Array, kind: SniffedType): Promise<ParseCvResult> {
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
      fullName: result.data.fullName,
      phone: result.data.phone,
      linkedinUrl: result.data.linkedinUrl,
      headline: result.data.headline,
      yearsExperience: result.data.yearsExperience,
      matchedSkills,
      unmatchedSkillLabels,
      matchedLanguages,
      unmatchedLanguageLabels,
      education: result.data.education,
      experience: result.data.experience,
      certifications: result.data.certifications,
    },
  };
}

/** Fresh-upload entry point — the draft prefills the candidate's own
 *  persistent, always-editable profile tabs (`CandidateProfileForm`);
 *  each section's existing `saveCandidate*Action` is what actually
 *  persists it, same as manual entry. */
export async function parseCvAction(formData: FormData): Promise<ParseCvResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0 || file.size > MAX_CV_BYTES) return { ok: false, reason: "file_too_large" };

  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffFileType(bytes);

  const result = await runCvExtraction(bytes, kind);
  if (!result.ok) return result;

  // Real-usage finding: analyzing a CV never used to store the file
  // itself — a candidate who only ever used "Analyze" ended up with a
  // fully-populated profile but nothing to download/preview. Persist it
  // as the master CV now, same as the plain "Upload CV" button already
  // does. A storage failure here doesn't block the review the candidate
  // is waiting on — the extraction itself already succeeded.
  await uploadCandidateCv(file);
  return result;
}

/** Re-analyze entry point (§ real-usage feedback: "why do I get asked to
 *  upload every time I already have a CV on file?") — re-runs extraction
 *  against the CV already in storage, no fresh upload required. Falls
 *  back to `not_a_candidate`'s sibling reason when there's genuinely
 *  nothing on file yet (the UI only offers this path when `hasCv` is
 *  already true, but a stale client state could still race it). */
export async function analyzeStoredCvAction(): Promise<ParseCvResult> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };

  const stored = await downloadMyCv();
  if (!stored) return { ok: false, reason: "bad_file" };

  return runCvExtraction(stored.bytes, stored.kind);
}

export async function dismissCvPromptAction() {
  await dismissCvPrompt();
  revalidatePath("/profile");
}
