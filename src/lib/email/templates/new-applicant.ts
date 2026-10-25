import type { EmailMessage } from "../types";
import { emailLayout, renderEntityCard, entityCardText } from "../layout";
import { SITE_URL as SITE } from "../site-url";

function initialsOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function newApplicantEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  /** The real `/recruit/applicants/[id]` detail page for this exact
   *  application, when the caller has the application id — falls back to
   *  the per-job applicants list when it doesn't. */
  applicantUrl: string;
  candidateAvatarUrl?: string | null;
}): EmailMessage {
  const { to, candidateName, jobTitle, applicantUrl, candidateAvatarUrl } = params;

  const card = {
    logoUrl: candidateAvatarUrl ?? null,
    initials: initialsOf(candidateName),
    title: candidateName,
    meta: `Applied for ${jobTitle}`,
    pill: "New applicant",
  };

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0 0 4px;"><strong>${candidateName}</strong> applied for your <strong>${jobTitle}</strong> job ad.</p>
    ${renderEntityCard(card)}
  `.trim();

  const bodyText = `${candidateName} applied for your "${jobTitle}" job ad.

${entityCardText(card)}`;

  const { html, text } = emailLayout({
    eyebrow: "New applicant",
    headline: "You have a new applicant",
    bodyHtml,
    bodyText,
    cta: { label: "View applicant", url: applicantUrl },
    footerContext: "You're receiving this because you manage job ads for your company on Just IT.",
    footerLinks: [
      { label: "Help centre", url: `${SITE}/pt/recruit/contact` },
      { label: "Privacy policy", url: `${SITE}/pt/privacy` },
    ],
  });

  return { to, subject: `New applicant for ${jobTitle}`, html, text };
}
