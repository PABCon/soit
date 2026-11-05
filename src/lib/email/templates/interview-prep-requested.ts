import type { EmailMessage } from "../types";

/** Candidate-authored free text (the optional note) — same reasoning as
 *  contact-message.ts's own escaping: longer, user-written content is
 *  meaningfully more likely to contain HTML-like characters than a short
 *  profile field. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function interviewPrepRequestedEmail(params: {
  to: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  requestedDate: string;
  requestedTime: string;
  note: string | null;
}): EmailMessage {
  const { to, candidateName, candidateEmail, candidatePhone, requestedDate, requestedTime, note } = params;

  const text = `New interview prep request from ${candidateName} <${candidateEmail}>${candidatePhone ? ` (${candidatePhone})` : ""}:

Requested: ${requestedDate} at ${requestedTime}
${note ? `\nNote: ${note}` : ""}

Reply directly to ${candidateEmail} to confirm.`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #182230;">
      <h1 style="color: #0C6B58; font-size: 18px; margin: 0 0 16px;">New interview prep request</h1>
      <p style="line-height: 1.6; margin: 0 0 12px;">
        <strong>${escapeHtml(candidateName)}</strong> (${escapeHtml(candidateEmail)}${candidatePhone ? `, ${escapeHtml(candidatePhone)}` : ""}) requested a session:
      </p>
      <div style="line-height: 1.6; background: #f5f7fb; border: 1px solid #e2e6ef; border-radius: 8px; padding: 16px;">
        <p style="margin: 0 0 8px;"><strong>When:</strong> ${escapeHtml(requestedDate)} at ${escapeHtml(requestedTime)}</p>
        ${note ? `<p style="margin: 0; white-space: pre-line;"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ""}
      </div>
      <p style="line-height: 1.6; margin: 16px 0 0;">Reply directly to this candidate's email to confirm.</p>
    </div>
  `.trim();

  return { to, subject: `Interview prep request: ${candidateName} — ${requestedDate}`, html, text };
}
