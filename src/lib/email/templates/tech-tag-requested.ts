import type { EmailMessage } from "../types";

/** Same escaping discipline as contact-message.ts — `label` is free-form
 *  employer-authored text (that's the whole point of this flow), not a
 *  fixed value from the vocabulary it's requesting to join. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function techTagRequestedEmail(params: { to: string; label: string; companyName: string }): EmailMessage {
  const { to, label, companyName } = params;

  const text = `${companyName} couldn't find "${label}" in the tech-tag list when posting a job and requested it be added.

Review it in Supabase (tech_tag_requests table) and add it to tech_tags if it's a real, distinct technology.`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">New tech tag requested</h1>
      <p><strong>${escapeHtml(companyName)}</strong> couldn't find "<strong>${escapeHtml(label)}</strong>" in the
        tech-tag list when posting a job and requested it be added.</p>
      <p>Review it in Supabase (<code>tech_tag_requests</code> table) and add it to <code>tech_tags</code>
        if it's a real, distinct technology.</p>
    </div>
  `.trim();

  return { to, subject: `Tech tag requested: ${label}`, html, text };
}
