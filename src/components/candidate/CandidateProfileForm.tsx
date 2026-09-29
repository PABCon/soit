"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CandidateProfile,
  CandidateSkillsAndEducation,
  CandidateCertificationEntry,
  CandidateExperienceEntry,
  CandidateJobPreferences,
} from "@/lib/db/candidate-profile";
import type { ParseCvResult } from "@/app/[locale]/(candidate)/profile/actions";
import { OverviewSection } from "@/components/candidate/OverviewSection";
import { JobPreferencesSection } from "@/components/candidate/JobPreferencesSection";
import { ExperienceSection } from "@/components/candidate/ExperienceSection";
import { SkillsEducationSection } from "@/components/candidate/SkillsEducationSection";

type TechTagOption = { id: string; label: string; aliases: string[] };
type SpokenLanguageOption = { id: string; slug: string; label: string };
type JobCategoryOption = { id: string; slug: string; label: string };
type LocationOption = { id: string; slug: string; name: string };

type Tab = "overview" | "preferences" | "experience" | "skills";
const TABS: Tab[] = ["overview", "preferences", "experience", "skills"];

type AiDraft = Extract<ParseCvResult, { ok: true }>["data"];

/**
 * §AI Pieces backlog, profile-depth phase — restructured into tabs
 * mirroring the justjoin.it reference (Overview / Job Preferences /
 * Experience / Skills & Education). Each tab owns its own section
 * component and its own save actions; this shell owns which tab is
 * showing plus the AI draft (phase 3): once "Analyze my CV" parses a CV,
 * the draft is lifted here (not applied straight to the database) and
 * fed into the affected sections as their *initial* state via a
 * `key`-forced remount — the candidate reviews/edits the AI's draft in
 * the exact same persistent UI they'd use for manual entry, then saves
 * each section normally. Editing an AI-derived result and editing by
 * hand are the same code path now.
 */
export function CandidateProfileForm({
  profile,
  cvSignedUrl,
  skillsAndEducation,
  certifications,
  experience,
  jobPreferences,
  techTags,
  spokenLanguages,
  jobCategories,
  locations,
}: {
  profile: CandidateProfile;
  cvSignedUrl: string | null;
  skillsAndEducation: CandidateSkillsAndEducation | null;
  certifications: CandidateCertificationEntry[];
  experience: CandidateExperienceEntry[];
  jobPreferences: CandidateJobPreferences | null;
  techTags: TechTagOption[];
  spokenLanguages: SpokenLanguageOption[];
  jobCategories: JobCategoryOption[];
  locations: LocationOption[];
}) {
  const t = useTranslations("profile");
  const [tab, setTab] = useState<Tab>("overview");
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  // Lifted here rather than left as OverviewSection's own local state —
  // that component gets key-remounted on every tab switch/draft arrival,
  // which would silently lose a freshly-fetched signed URL otherwise (a
  // real bug this phase's own verification caught).
  const [signedUrl, setSignedUrl] = useState(cvSignedUrl);

  function handleDraftReady(draft: AiDraft, newSignedUrl: string | null) {
    setAiDraft(draft);
    setSignedUrl(newSignedUrl);
    setDraftVersion((v) => v + 1);
    setTab("skills");
  }

  const effectiveSkillsAndEducation: CandidateSkillsAndEducation | null = aiDraft
    ? {
        headline: aiDraft.headline ?? skillsAndEducation?.headline ?? null,
        yearsExperience: aiDraft.yearsExperience ?? skillsAndEducation?.yearsExperience ?? null,
        techTags: aiDraft.matchedSkills.map((s) => ({ techTagId: s.techTagId, label: s.label, level: null })),
        languages: aiDraft.matchedLanguages.map((l) => ({
          spokenLanguageId: l.spokenLanguageId,
          label: l.label,
          level: l.level,
        })),
        education: aiDraft.education.map((e) => ({
          id: "",
          institution: e.institution,
          degree: e.degree,
          fieldOfStudy: e.fieldOfStudy,
          startDate: e.startDate,
          endDate: e.endDate,
          note: e.note,
        })),
      }
    : skillsAndEducation;

  const effectiveCertifications: CandidateCertificationEntry[] = aiDraft
    ? aiDraft.certifications.map((c) => ({ id: "", name: c.name, issuer: c.issuer, issuedDate: c.issuedDate }))
    : certifications;

  const effectiveExperience: CandidateExperienceEntry[] = aiDraft
    ? aiDraft.experience.map((e) => ({
        id: "",
        title: e.title,
        company: e.company,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      }))
    : experience;

  // Real-usage feedback: name/phone/LinkedIn were never extracted at all
  // — usually right there in a CV's own header block. Only overrides a
  // field the draft actually found; an account's existing name is never
  // blanked out just because a CV didn't restate it.
  const effectiveProfile: CandidateProfile = aiDraft
    ? {
        ...profile,
        fullName: aiDraft.fullName ?? profile.fullName,
        phone: aiDraft.phone ?? profile.phone,
        linkedinUrl: aiDraft.linkedinUrl ?? profile.linkedinUrl,
      }
    : profile;

  return (
    <div>
      {aiDraft && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("aiDraftNotice")}</p>
      )}

      <div role="tablist" className="flex gap-1 border-b border-line">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "border-b-2 border-pine px-4 py-2 text-sm font-medium text-pine"
                : "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted hover:text-ink"
            }
          >
            {t(`tab.${key}`)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <OverviewSection
            key={`overview-${draftVersion}`}
            profile={effectiveProfile}
            cvSignedUrl={signedUrl}
            headline={effectiveSkillsAndEducation?.headline ?? null}
            yearsExperience={effectiveSkillsAndEducation?.yearsExperience ?? null}
            onDraftReady={handleDraftReady}
          />
        )}
        {tab === "preferences" && (
          <JobPreferencesSection preferences={jobPreferences} jobCategories={jobCategories} locations={locations} />
        )}
        {tab === "experience" && (
          <ExperienceSection key={`experience-${draftVersion}`} experience={effectiveExperience} />
        )}
        {tab === "skills" && (
          <SkillsEducationSection
            key={`skills-${draftVersion}`}
            skillsAndEducation={effectiveSkillsAndEducation}
            certifications={effectiveCertifications}
            techTags={techTags}
            spokenLanguages={spokenLanguages}
            unmatchedSkillLabels={aiDraft?.unmatchedSkillLabels ?? []}
            unmatchedLanguageLabels={aiDraft?.unmatchedLanguageLabels ?? []}
          />
        )}
      </div>
    </div>
  );
}
