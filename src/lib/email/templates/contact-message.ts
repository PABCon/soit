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
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">New contact message</h1>
      <p><strong>${escapeHtml(fromName)}</strong> (${escapeHtml(fromEmail)}) wrote:</p>
      <p style="white-space: pre-line;">${escapeHtml(message)}</p>
    </div>
  `.trim();

  return { to, subject: `New contact message from ${fromName}`, html, text };
}
