import type { EmailMessage } from "../types";
import { emailLayout } from "../layout";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function jobAdsSubscribedEmail(params: {
  to: string;
  companyName: string;
  slotCap: number;
  billingInterval: "month" | "year";
  renewalDate?: string | null;
}): EmailMessage {
  const { to, companyName, slotCap, billingInterval, renewalDate } = params;
  const cadence = billingInterval === "year" ? "annually" : "monthly";

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;margin:0 0 12px;">Hi ${companyName},</p>
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0;">Your job ads subscription is now active, billed <strong>${cadence}</strong>${renewalDate ? ` &mdash; renews ${renewalDate}` : ""}. You can now have up to <strong>${slotCap} live job ads</strong> at once for as long as the subscription stays active.</p>
  `.trim();

  const bodyText = `Hi ${companyName},

Your job ads subscription is now active, billed ${cadence}${renewalDate ? ` — renews ${renewalDate}` : ""}. You can now have up to ${slotCap} live job ads at once for as long as the subscription stays active.`;

  const { html, text } = emailLayout({
    eyebrow: "Subscription confirmed",
    headline: `${slotCap} job ad slots are active`,
    bodyHtml,
    bodyText,
    cta: { label: "Post a job", url: `${SITE}/pt/recruit/jobs/new` },
    footerContext: "You're receiving this because you subscribed to a job ads plan on Just IT.",
    footerLinks: [
      { label: "Manage billing", url: `${SITE}/pt/recruit/jobs/ads` },
      { label: "Privacy policy", url: `${SITE}/pt/privacy` },
    ],
  });

  return { to, subject: `Your ${slotCap}-job-ad plan is active`, html, text };
}
