import type { EmailMessage } from "../types";
import { emailLayout, renderEntityCard, entityCardText } from "../layout";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function initialsOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function savedSearchDigestEmail(params: {
  to: string;
  searchLabel: string;
  jobs: { title: string; companyName: string; url: string; companyLogoUrl?: string | null }[];
  searchUrl: string;
}): EmailMessage {
  const { to, searchLabel, jobs, searchUrl } = params;
  const jobWord = jobs.length === 1 ? "new job matches" : "new jobs match";

  const cards = jobs.map((j) => ({
    logoUrl: j.companyLogoUrl ?? null,
    initials: initialsOf(j.companyName),
    title: j.title,
    meta: j.companyName,
    href: j.url,
  }));

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0 0 4px;">Here's what's new for your saved search <strong>&ldquo;${searchLabel}&rdquo;</strong>:</p>
    ${cards.map((c) => renderEntityCard(c)).join("")}
  `.trim();

  const bodyText = `${jobs.length} ${jobWord} your saved search "${searchLabel}":

${cards.map((c) => entityCardText(c)).join("\n")}`;

  const { html, text } = emailLayout({
    eyebrow: "Saved search",
    headline: `${jobs.length} ${jobWord} &ldquo;${searchLabel}&rdquo;`,
    bodyHtml,
    bodyText,
    cta: { label: "See the full search", url: searchUrl },
    footerContext: "You're receiving this because you turned on notifications for this saved search on Just IT.",
    footerLinks: [{ label: "Manage saved searches", url: `${SITE}/pt/saved-searches` }, { label: "Privacy policy", url: `${SITE}/pt/privacy` }],
  });

  return { to, subject: `${jobs.length} ${jobWord} "${searchLabel}"`, html, text };
}
