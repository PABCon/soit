import type { EmailMessage } from "../types";

/** The contact form's `message` is free-form, user-authored text — longer
 *  and far more likely to contain HTML-like characters than the short
 *  profile fields the other two templates interpolate, so this one
 *  escapes before embedding in the `html` body. Once a real provider is
 *  wired in (§ go-live checklist), an unescaped `<script>`/`<img onerror>`
 *  here would actually render in the recipient's email client. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function contactMessageEmail(params: {
  to: string;
  fromName: string;
  fromEmail: string;
  message: string;
}): EmailMessage {
  const { to, fromName, fromEmail, message } = params;

  const text = `New contact message from ${fromName} <${fromEmail}>:

${message}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #182230;">
      <h1 style="color: #0C6B58; font-size: 18px; margin: 0 0 16px;">New contact message</h1>
      <p style="line-height: 1.6; margin: 0 0 12px;"><strong>${escapeHtml(fromName)}</strong> (${escapeHtml(fromEmail)}) wrote:</p>
      <div style="white-space: pre-line; line-height: 1.6; background: #f5f7fb; border: 1px solid #e2e6ef; border-radius: 8px; padding: 16px;">${escapeHtml(message)}</div>
    </div>
  `.trim();

  return { to, subject: `New contact message from ${fromName}`, html, text };
}
