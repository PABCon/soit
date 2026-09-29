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

/**
 * §AI Pieces backlog, profile-depth phase — restructured into tabs
 * mirroring the justjoin.it reference (Overview / Job Preferences /
 * Experience / Skills & Education): the page had grown from a single
 * small form into six independent, always-editable sections, and no
 * reusable tab widget existed anywhere in this codebase yet, so this is a
 * small from-scratch one (a handful of buttons + one `activeTab` state,
 * no library). Each tab owns its own section component and its own save
 * actions — this shell only owns which tab is showing and a shared
 * `key`-based remount after an "Analyze my CV" apply (`onAnalyzed`), so
 * every section re-reads its freshly-saved server data.
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

  return (
    <div>
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
            profile={profile}
            cvSignedUrl={cvSignedUrl}
            headline={skillsAndEducation?.headline ?? null}
            yearsExperience={skillsAndEducation?.yearsExperience ?? null}
            techTags={techTags}
            spokenLanguages={spokenLanguages}
            onAnalyzed={() => window.location.reload()}
          />
        )}
        {tab === "preferences" && (
          <JobPreferencesSection preferences={jobPreferences} jobCategories={jobCategories} locations={locations} />
        )}
        {tab === "experience" && <ExperienceSection experience={experience} />}
        {tab === "skills" && (
          <SkillsEducationSection
            skillsAndEducation={skillsAndEducation}
            certifications={certifications}
            techTags={techTags}
            spokenLanguages={spokenLanguages}
          />
        )}
      </div>
    </div>
  );
}
