import type { EmailMessage } from "../types";

/** One template, two directions — the two real notification moments
 *  from the reference doc: a candidate's first look at an employer's
 *  outreach, and an employer finding out a previously-blinded match
 *  finally replied ("Start hiring!"). Shaped exactly like
 *  new-applicant.ts. */
export function newMessageEmail(params: {
  to: string;
  recipientRole: "employer" | "candidate";
  otherPartyLabel: string;
  jobTitle: string;
  inboxUrl: string;
  /** Set only when the candidate recipient has no account — they can't
   *  open `inboxUrl` to log in, so the CTA has to be registration instead
   *  of "read the message." Always null for an employer recipient. */
  registerUrl: string | null;
}): EmailMessage {
  const { to, recipientRole, otherPartyLabel, jobTitle, inboxUrl, registerUrl } = params;
  const heading = recipientRole === "employer" ? "New message from a candidate" : "New message from an employer";

  const cta = registerUrl
    ? { url: registerUrl, label: "Create a free account to read and reply" }
    : { url: inboxUrl, label: "Read the message" };
  const registerNote = registerUrl
    ? `\n\nYou applied without an account, so create one with this same email address (${to}) to read it and reply.`
    : "";

  const text = `You have a new message.

${otherPartyLabel} sent you a message about "${jobTitle}".${registerNote}

${cta.label}: ${cta.url}

— Just IT`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">${heading}</h1>
      <p><strong>${otherPartyLabel}</strong> sent you a message about "<strong>${jobTitle}</strong>".</p>
      ${registerUrl ? `<p>You applied without an account, so create one with this same email address to read it and reply.</p>` : ""}
      <p><a href="${cta.url}" style="color: #0C6B58;">${cta.label}</a></p>
      <p style="color: #5b6b66; font-size: 12px;">— Just IT</p>
    </div>
  `.trim();

  return { to, subject: heading, html, text };
}
