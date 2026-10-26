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

/** §job-import follow-up: this used to be an action-required email ("a
 *  human needs to review and add this"). Requests now resolve immediately
 *  via an LLM validation step (validate-tech-tag.ts) — nothing here is
 *  waiting on a human any more. This is a pure audit/FYI record of what
 *  the system decided on its own, in case something worth pruning later
 *  slips through. */
export function techTagRequestedEmail(params: {
  to: string;
  label: string;
  companyName: string;
  outcome: "created" | "aliased" | "rejected";
  matchedLabel?: string;
}): EmailMessage {
  const { to, label, companyName, outcome, matchedLabel } = params;

  const summary =
    outcome === "created"
      ? `was added as a new tech tag`
      : outcome === "aliased"
        ? `was added as an alias of the existing tag "${matchedLabel}"`
        : `was rejected (not recognized as a real, distinct technology)`;

  const text = `${companyName} requested "${label}" as a tech tag — it ${summary}, automatically, no action needed. Logged in tech_tag_requests for reference.`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #182230;">
      <h1 style="color: #0C6B58; font-size: 18px; margin: 0 0 16px;">Tech tag request auto-resolved</h1>
      <p style="line-height: 1.6; margin: 0 0 12px;"><strong>${escapeHtml(companyName)}</strong> requested "<strong>${escapeHtml(label)}</strong>" — it ${escapeHtml(summary)}, automatically. No action needed.</p>
      <p style="line-height: 1.6; margin: 0; color: #667085; font-size: 13px;">Logged in <code>tech_tag_requests</code> for reference.</p>
    </div>
  `.trim();

  return { to, subject: `Tech tag auto-resolved: ${label}`, html, text };
}
