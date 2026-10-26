import type { EmailMessage } from "../types";
import { emailLayout } from "../layout";
import { SITE_URL as SITE } from "../site-url";

export function jobImportStartedEmail(params: {
  to: string;
  companyName: string;
  sourceUrl: string;
  foundCount: number;
  /** True when the discovery crawl stopped before genuinely running out of
   *  pages (hit its page limit, or a later page failed to load) — real-
   *  usage finding: a careers page with many more pages than we check was
   *  silently truncated with no signal to the employer at all. */
  truncated?: boolean;
}): EmailMessage {
  const { to, companyName, sourceUrl, foundCount, truncated } = params;
  const jobsWord = foundCount === 1 ? "job posting" : "job postings";
  const truncatedNote = truncated
    ? " Your careers page may have more open roles than we checked — if some are missing from your Drafts, let us know and we'll take a closer look."
    : "";

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;margin:0 0 12px;">Hi ${companyName},</p>
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0;">We started fetching jobs from <strong>${sourceUrl}</strong> — found ${foundCount} ${jobsWord} there. They're being added to your Drafts now; we'll email you again once this finishes.${truncatedNote}</p>
  `.trim();

  const bodyText = `Hi ${companyName},

We started fetching jobs from ${sourceUrl} — found ${foundCount} ${jobsWord} there. They're being added to your Drafts now; we'll email you again once this finishes.${truncatedNote}`;

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
