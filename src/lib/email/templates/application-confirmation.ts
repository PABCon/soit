import type { EmailMessage } from "../types";

export function applicationConfirmationEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
}): EmailMessage {
  const { to, candidateName, jobTitle, companyName } = params;

  const text = `Hi ${candidateName},

Your application has been sent to ${companyName} for the "${jobTitle}" role.

We keep our fingers crossed for you!

— SóIT`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">Your application has been sent</h1>
      <p>Hi ${candidateName},</p>
      <p>Your application has been sent to <strong>${companyName}</strong> for the
        "<strong>${jobTitle}</strong>" role.</p>
      <p>We keep our fingers crossed for you!</p>
      <p style="color: #5b6b66; font-size: 12px;">— SóIT</p>
    </div>
  `.trim();

  return { to, subject: `You applied for ${jobTitle}`, html, text };
}
