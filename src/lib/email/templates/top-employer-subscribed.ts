import type { EmailMessage } from "../types";
import { emailLayout } from "../layout";
import { SITE_URL as SITE } from "../site-url";

const BENEFITS = [
  "A verified Top Employer badge",
  "Priority placement across Just IT",
  "API access for programmatic job posting",
  "Free monthly ad bumps",
  "A richer company profile — about us, team, testimonials, galleries",
];

function benefitsListHtml(): string {
  const items = BENEFITS.map(
    (b) =>
      `<li style="margin-bottom:6px;"><span style="color:#465bff;font-weight:700;">&check;</span>&nbsp; ${b}</li>`,
  ).join("");
  return `<ul style="list-style:none;padding:0;margin:16px 0;font-size:14px;color:#182230;">${items}</ul>`;
}

export function topEmployerSubscribedEmail(params: {
  to: string;
  companyName: string;
  billingInterval: "month" | "year";
  renewalDate?: string | null;
}): EmailMessage {
  const { to, companyName, billingInterval, renewalDate } = params;
  const cadence = billingInterval === "year" ? "annually" : "monthly";

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;margin:0 0 12px;">Hi ${companyName},</p>
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0 0 4px;">Your Top Employer subscription is now active, billed <strong>${cadence}</strong>${renewalDate ? ` &mdash; renews ${renewalDate}` : ""}.</p>
    ${benefitsListHtml()}
  `.trim();

  const bodyText = `Hi ${companyName},

Your Top Employer subscription is now active, billed ${cadence}${renewalDate ? ` — renews ${renewalDate}` : ""}.

You now have:
${BENEFITS.map((b) => `- ${b}`).join("\n")}`;

  const { html, text } = emailLayout({
    eyebrow: "Subscription confirmed",
    headline: "You're a Top Employer",
    bodyHtml,
    bodyText,
    cta: { label: "Go to my company profile", url: `${SITE}/pt/recruit/company` },
    footerContext: "You're receiving this because you subscribed to Top Employer on Just IT.",
    footerLinks: [
      { label: "Manage billing", url: `${SITE}/pt/recruit/jobs/ads` },
      { label: "Privacy policy", url: `${SITE}/pt/privacy` },
    ],
  });

  return { to, subject: "You're a Top Employer now", html, text };
}
