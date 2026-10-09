import type { EmailMessage } from "../types";

export function applicationConfirmationEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  /** Set only for the account-free apply path — null for a candidate who
   *  already has an account. When set, nudges the applicant to register
   *  with this same email so they can track the application and read any
   *  reply (registering reattaches this exact application automatically,
   *  it doesn't require anything else from them). */
  registerUrl: string | null;
}): EmailMessage {
  const { to, candidateName, jobTitle, companyName, registerUrl } = params;

  const registerText = registerUrl
    ? `\n\nYou applied without an account. Create one with this same email address (${to}) to track this application and read any reply from ${companyName}: ${registerUrl}`
    : "";
  const registerHtml = registerUrl
    ? `<p>You applied without an account. <a href="${registerUrl}" style="color: #0C6B58;">Create one with this same email address</a> to track this application and read any reply from ${companyName}.</p>`
    : "";

  const text = `Hi ${candidateName},

Your application has been sent to ${companyName} for the "${jobTitle}" role.

We keep our fingers crossed for you!${registerText}

— Just IT`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">Your application has been sent</h1>
      <p>Hi ${candidateName},</p>
      <p>Your application has been sent to <strong>${companyName}</strong> for the
        "<strong>${jobTitle}</strong>" role.</p>
      <p>We keep our fingers crossed for you!</p>
      ${registerHtml}
      <p style="color: #5b6b66; font-size: 12px;">— Just IT</p>
    </div>
  `.trim();

  return { to, subject: `You applied for ${jobTitle}`, html, text };
}
