import { createClient } from "@/lib/supabase/server";
import {
  getMyCandidateProfile,
  getMyCandidateSkillsAndEducation,
  getMyCandidateExperience,
  getMyCandidateCertifications,
  getMyCandidateJobPreferences,
} from "./candidate-profile";
import { getMyApplications } from "./applications";
import { getMyFavoriteJobs } from "./favorites";
import { getMySavedSearches } from "./saved-searches";
import { getMyThreadsAsCandidate, getThreadDetail } from "./messaging";

/**
 * GDPR data export / right to data portability (real-usage QA item) —
 * a candidate's complete self-service download of their own data.
 * Deliberately composes this project's own already-existing per-section
 * getters (each already RLS-scoped to "my own row", each already the
 * real source of truth the UI itself reads) rather than writing a
 * second, parallel set of queries that could drift from what those
 * pages actually show. Messages are included in full (both directions
 * of every thread the candidate is in) — a message a candidate sent is
 * as much "their data" as a job application is, and GDPR's own
 * portability right doesn't stop at content they merely filled into a
 * form.
 */
export async function getMyDataExport() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, skillsAndEducation, experience, certifications, jobPreferences, applications, favoriteJobs, savedSearches, threadSummaries] =
    await Promise.all([
      getMyCandidateProfile(),
      getMyCandidateSkillsAndEducation(),
      getMyCandidateExperience(),
      getMyCandidateCertifications(),
      getMyCandidateJobPreferences(),
      getMyApplications(),
      getMyFavoriteJobs(),
      getMySavedSearches(),
      getMyThreadsAsCandidate(),
    ]);

  const threads = await Promise.all(
    threadSummaries.map(async (summary) => {
      const detail = await getThreadDetail(summary.threadId);
      return {
        companyName: summary.companyName,
        jobTitle: summary.jobTitle,
        messages: detail.ok ? detail.messages.map((m) => ({ from: m.senderType, body: m.body, sentAt: m.createdAt })) : [],
      };
    }),
  );

  return {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, accountCreatedAt: user.created_at },
    profile,
    skillsAndEducation,
    experience,
    certifications,
    jobPreferences,
    applications: applications.map((a) => ({
      jobTitle: a.job.title,
      companyName: a.job.company.name,
      status: a.status,
      appliedAt: a.createdAt,
    })),
    favoriteJobs: favoriteJobs.map((j) => ({ title: j.title, companySlug: j.company.slug })),
    savedSearches: savedSearches.map((s) => ({ label: s.label, query: s.query, createdAt: s.createdAt })),
    messageThreads: threads,
  };
}
