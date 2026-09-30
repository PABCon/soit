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
}): EmailMessage {
  const { to, recipientRole, otherPartyLabel, jobTitle, inboxUrl } = params;
  const heading = recipientRole === "employer" ? "New message from a candidate" : "New message from an employer";

  const text = `You have a new message.

${otherPartyLabel} sent you a message about "${jobTitle}".

Read it here: ${inboxUrl}

— Just IT`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">${heading}</h1>
      <p><strong>${otherPartyLabel}</strong> sent you a message about "<strong>${jobTitle}</strong>".</p>
      <p><a href="${inboxUrl}" style="color: #0C6B58;">Read the message</a></p>
      <p style="color: #5b6b66; font-size: 12px;">— Just IT</p>
    </div>
  `.trim();

  return { to, subject: heading, html, text };
}
