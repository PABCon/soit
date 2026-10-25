import type { EmailMessage } from "../types";
import { emailLayout, renderEntityCard, entityCardText } from "../layout";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const WORK_MODEL_LABEL: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", office: "On-site" };

function initialsOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function applicationConfirmationEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  /** Null for a remote job, or when the job has no stored location text. */
  location?: string | null;
  workModel?: "remote" | "hybrid" | "office" | null;
  companyLogoUrl?: string | null;
  jobUrl?: string | null;
  /** Set only for the account-free apply path — null for a candidate who
   *  already has an account. When set, nudges the applicant to register
   *  with this same email so they can track the application and read any
   *  reply (registering reattaches this exact application automatically,
   *  it doesn't require anything else from them). */
  registerUrl: string | null;
}): EmailMessage {
  const { to, candidateName, jobTitle, companyName, location, workModel, companyLogoUrl, jobUrl, registerUrl } = params;

  const metaParts = [companyName, location ?? null, workModel ? WORK_MODEL_LABEL[workModel] : null].filter(Boolean);
  const card = {
    logoUrl: companyLogoUrl ?? null,
    initials: initialsOf(companyName),
    title: jobTitle,
    meta: metaParts.join(" &middot; "),
    pill: "Application received",
    href: jobUrl ?? undefined,
  };

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;margin:0 0 12px;">Hi ${candidateName},</p>
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0 0 4px;">Your application has been sent to <strong>${companyName}</strong>. We keep our fingers crossed for you!</p>
    ${renderEntityCard(card)}
    <p style="font-size:14px;color:#667085;line-height:1.6;margin:0 0 4px;">${companyName} reviews applications directly in Just IT — you'll hear back here if they're interested.</p>
  `.trim();

  const bodyText = `Hi ${candidateName},

Your application has been sent to ${companyName} for the "${jobTitle}" role. We keep our fingers crossed for you!

${entityCardText(card)}

${companyName} reviews applications directly in Just IT — you'll hear back here if they're interested.`;

  const { html, text } = emailLayout({
    eyebrow: "Application confirmation",
    headline: "Your application has been sent",
    bodyHtml,
    bodyText,
    cta: registerUrl ? { label: "Create your Just IT account", url: registerUrl } : undefined,
    secondaryLink: registerUrl ? { label: "Already have an account? Log in", url: `${SITE}/pt/candidate/login` } : undefined,
    note: registerUrl
      ? `You applied without an account. Create one with this same email address (${to}) to track this application and read any reply from ${companyName}.`
      : undefined,
    footerContext: "You're receiving this because you applied for a job through Just IT.",
    footerLinks: [{ label: "Privacy policy", url: `${SITE}/pt/privacy` }],
  });

  return { to, subject: `You applied for ${jobTitle}`, html, text };
}
