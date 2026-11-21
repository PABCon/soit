import type { EmailMessage } from "../types";
import { emailLayout } from "../layout";
import { SITE_URL as SITE } from "../site-url";

/** Matchmaking rework, Phase 3. Notifies the employer of a candidate's
 *  response to a connection request. Employer-only (the candidate
 *  already knows their own decision the moment they make it). Never
 *  names the candidate in either direction, same genericism
 *  new-message.ts's own employer-facing copy already uses. The
 *  employer sees the real name once they open the now-unlocked thread;
 *  this is only the nudge to go look. */
export function connectionResponseEmail(params: {
  to: string;
  decision: "accepted" | "declined";
  jobTitle: string;
  threadUrl: string;
}): EmailMessage {
  const { to, decision, jobTitle, threadUrl } = params;

  const heading =
    decision === "accepted" ? "A candidate accepted your connection request" : "A candidate declined your connection request";

  const bodyHtml =
    decision === "accepted"
      ? `<p style="font-size:15px;color:#182230;line-height:1.6;margin:0;">A candidate has accepted your request to connect about <strong>${jobTitle}</strong>. You can now see their full profile and continue the conversation.</p>`
      : `<p style="font-size:15px;color:#182230;line-height:1.6;margin:0;">A candidate chose not to connect about <strong>${jobTitle}</strong>. Their identity stays private, as always.</p>`;

  const bodyText =
    decision === "accepted"
      ? `A candidate has accepted your request to connect about "${jobTitle}". You can now see their full profile and continue the conversation.`
      : `A candidate chose not to connect about "${jobTitle}". Their identity stays private, as always.`;

  const { html, text } = emailLayout({
    eyebrow: "Connection request",
    headline: heading,
    bodyHtml,
    bodyText,
    cta: decision === "accepted" ? { label: "View conversation", url: threadUrl } : { label: "View your matches", url: `${SITE}/pt/recruit/matchmaking` },
    footerContext: "You're receiving this because you sent a connection request through Just IT.",
    footerLinks: [
      { label: "Help centre", url: `${SITE}/pt/recruit/contact` },
      { label: "Privacy policy", url: `${SITE}/pt/privacy` },
    ],
  });

  return { to, subject: heading, html, text };
}
