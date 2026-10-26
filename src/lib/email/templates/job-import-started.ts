import type { EmailMessage } from "../types";
import { emailLayout } from "../layout";
import { SITE_URL as SITE } from "../site-url";

export function jobImportStartedEmail(params: {
  to: string;
  companyName: string;
  sourceUrl: string;
  foundCount: number;
}): EmailMessage {
  const { to, companyName, sourceUrl, foundCount } = params;
  const jobsWord = foundCount === 1 ? "job posting" : "job postings";

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;margin:0 0 12px;">Hi ${companyName},</p>
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0;">We started fetching jobs from <strong>${sourceUrl}</strong> — found ${foundCount} ${jobsWord} there. They're being added to your Drafts now; we'll email you again once this finishes.</p>
  `.trim();

  const bodyText = `Hi ${companyName},

We started fetching jobs from ${sourceUrl} — found ${foundCount} ${jobsWord} there. They're being added to your Drafts now; we'll email you again once this finishes.`;

  const { html, text } = emailLayout({
    eyebrow: "Job import",
    headline: "Fetching your jobs started",
    bodyHtml,
    bodyText,
    cta: { label: "View my job ads", url: `${SITE}/pt/recruit` },
    footerContext: "You're receiving this because you started a job import on Just IT.",
    footerLinks: [{ label: "Privacy policy", url: `${SITE}/pt/privacy` }],
  });

  return { to, subject: "Fetching your jobs started", html, text };
}
