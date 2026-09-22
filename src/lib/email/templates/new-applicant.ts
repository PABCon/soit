import type { EmailMessage } from "../types";

export function newApplicantEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  applicantsUrl: string;
}): EmailMessage {
  const { to, candidateName, jobTitle, applicantsUrl } = params;

  const text = `You have a new applicant.

${candidateName} applied for "${jobTitle}".

Review it here: ${applicantsUrl}

— SóIT`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">New applicant</h1>
      <p><strong>${candidateName}</strong> applied for "<strong>${jobTitle}</strong>".</p>
      <p><a href="${applicantsUrl}" style="color: #0C6B58;">Review the application</a></p>
      <p style="color: #5b6b66; font-size: 12px;">— SóIT</p>
    </div>
  `.trim();

  return { to, subject: `New applicant for ${jobTitle}`, html, text };
}
