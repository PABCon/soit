import type { EmailMessage } from "../types";
import { emailLayout } from "../layout";
import { SITE_URL as SITE } from "../site-url";

/** Sent after every batch completes, not just once at the end — so an
 *  employer can start reviewing and publishing from Drafts right away
 *  instead of waiting for the whole import to finish. */
export function jobImportProgressEmail(params: {
  to: string;
  companyName: string;
  justImported: number;
  totalImported: number;
}): EmailMessage {
  const { to, companyName, justImported, totalImported } = params;
  const justWord = justImported === 1 ? "job" : "jobs";

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;margin:0 0 12px;">Hi ${companyName},</p>
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0;">${justImported} more ${justWord} just landed in your Drafts (${totalImported} so far). You can review and publish them any time — no need to wait for the rest.</p>
  `.trim();

  const bodyText = `Hi ${companyName},

${justImported} more ${justWord} just landed in your Drafts (${totalImported} so far). You can review and publish them any time — no need to wait for the rest.`;

  const { html, text } = emailLayout({
    eyebrow: "Job import",
    headline: `${justImported} more ${justWord} ready to review`,
    bodyHtml,
    bodyText,
    cta: { label: "Review my drafts", url: `${SITE}/pt/recruit` },
    footerContext: "You're receiving this because you started a job import on Just IT.",
    footerLinks: [{ label: "Privacy policy", url: `${SITE}/pt/privacy` }],
  });

  return { to, subject: `${justImported} more ${justWord} ready to review`, html, text };
}
