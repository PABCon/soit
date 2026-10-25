import type { EmailMessage } from "../types";
import { emailLayout, renderEntityCard, entityCardText } from "../layout";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const MAX_EXCERPT = 140;

function initialsOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

/** Same escaping discipline as contact-message.ts — a message body is
 *  free-form, user-authored text, not a short profile field. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > MAX_EXCERPT ? `${trimmed.slice(0, MAX_EXCERPT).trimEnd()}…` : trimmed;
}

/** One template, two directions — the two real notification moments
 *  from the reference doc: a candidate's first look at an employer's
 *  outreach, and an employer finding out a previously-blinded match
 *  finally replied ("Start hiring!"). Message-preview card mirrors
 *  new-applicant.ts's entity card, using the real message body when the
 *  trigger has it (both messaging.ts call sites do — it's the body
 *  `sendMessage()` just inserted). */
export function newMessageEmail(params: {
  to: string;
  recipientRole: "employer" | "candidate";
  otherPartyLabel: string;
  jobTitle: string;
  inboxUrl: string;
  /** The just-sent message's own text, truncated for the preview card.
   *  Never fabricated — omitted entirely if the caller doesn't have it. */
  messageExcerpt?: string | null;
  /** Set only when the candidate recipient has no account — they can't
   *  open `inboxUrl` to log in, so the CTA has to be registration instead
   *  of "read the message." Always null for an employer recipient. */
  registerUrl: string | null;
}): EmailMessage {
  const { to, recipientRole, otherPartyLabel, jobTitle, inboxUrl, messageExcerpt, registerUrl } = params;
  const heading = recipientRole === "employer" ? "New message from a candidate" : "New message from an employer";
  const rawExcerpt = messageExcerpt?.trim() ? truncate(messageExcerpt) : null;

  const htmlCard = {
    initials: initialsOf(otherPartyLabel),
    title: otherPartyLabel,
    meta: `About ${jobTitle}`,
    quote: rawExcerpt ? escapeHtml(rawExcerpt) : null,
  };
  const textCard = { ...htmlCard, quote: rawExcerpt };

  const cta = registerUrl
    ? { label: "Create a free account to read and reply", url: registerUrl }
    : { label: "Open conversation", url: inboxUrl };

  const bodyHtml = `
    <p style="font-size:15px;color:#182230;line-height:1.6;margin:0 0 4px;"><strong>${otherPartyLabel}</strong> sent you a message about <strong>${jobTitle}</strong>.</p>
    ${renderEntityCard(htmlCard)}
  `.trim();

  const bodyText = `${otherPartyLabel} sent you a message about "${jobTitle}".

${entityCardText(textCard)}`;

  const footerLinks =
    recipientRole === "employer"
      ? [
          { label: "Help centre", url: `${SITE}/pt/recruit/contact` },
          { label: "Privacy policy", url: `${SITE}/pt/privacy` },
        ]
      : [{ label: "Privacy policy", url: `${SITE}/pt/privacy` }];

  const { html, text } = emailLayout({
    eyebrow: "New message",
    headline: heading,
    bodyHtml,
    bodyText,
    cta,
    note: registerUrl
      ? `You applied without an account, so create one with this same email address (${to}) to read it and reply.`
      : undefined,
    footerContext:
      recipientRole === "employer"
        ? "You're receiving this because a candidate messaged you through Just IT."
        : "You're receiving this because an employer messaged you through Just IT.",
    footerLinks,
  });

  return { to, subject: heading, html, text };
}
