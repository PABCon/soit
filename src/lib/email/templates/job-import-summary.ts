import type { EmailMessage } from "../types";
import { emailLayout } from "../layout";
import { SITE_URL as SITE } from "../site-url";

/** The one-time final email, sent only once a run actually finishes
 *  (import list fully worked through) — deliberately reports plain counts
 *  only, never why it stopped (e.g. a plan limit) — that's an internal
 *  detail, not something to put in front of a customer. */
export function jobImportSummaryEmail(params: {
  to: string;
  companyName: string;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
}): EmailMessage {
  const { to, companyName, importedCount, skippedCount, failedCount } = params;

  const details: string[] = [];
  if (skippedCount > 0) details.push(`${skippedCount} already imported before`);
  if (failedCount > 0) details.push(`${failedCount} couldn't be read`);
  const detailsText = details.length > 0 ? ` (${details.join(", ")})` : "";

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;margin:0 0 12px;">Hi ${companyName},</p>
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0;">Your job import is complete — <strong>${importedCount}</strong> new job${importedCount === 1 ? "" : "s"} added to your Drafts${detailsText}. Review and publish them whenever you're ready.</p>
  `.trim();

  const bodyText = `Hi ${companyName},

Your job import is complete — ${importedCount} new job(s) added to your Drafts${detailsText}. Review and publish them whenever you're ready.`;

  const { html, text } = emailLayout({
    eyebrow: "Job import",
    headline: "Your job import is complete",
    bodyHtml,
    bodyText,
    cta: { label: "Review my drafts", url: `${SITE}/pt/recruit` },
    footerContext: "You're receiving this because you started a job import on Just IT.",
    footerLinks: [{ label: "Privacy policy", url: `${SITE}/pt/privacy` }],
  });

  return { to, subject: "Your job import is complete", html, text };
}
