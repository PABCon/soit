/** §9.1b — the shared visual system every branded transactional email is
 *  built from (reference: "Justit Application Confirmation Email.png").
 *  Two pieces: `emailLayout()` (logo header, eyebrow, headline, CTA,
 *  footer) and `renderEntityCard()` (the light-blue job/applicant summary
 *  card). Both are plain string builders — no React/JSX — matching every
 *  other file in this directory. Operational-only templates
 *  (contact-message, tech-tag-requested) deliberately don't use this: the
 *  user asked for those to stay plain, not branded. */

import { SITE_URL as SITE } from "./site-url";

const LOGO_URL = `${SITE}/logo-justit.png`;

/** Security audit finding: every field this shared layout interpolates
 *  into HTML was unescaped — `contact-message.ts`/`new-message.ts`
 *  already have (and use) the identical fix locally, this is the same
 *  one applied where it protects every caller of `emailLayout`/
 *  `renderEntityCard` at once (job titles, applicant/candidate names,
 *  message bodies, saved-search labels — all real, user-authored text
 *  that reaches these templates). `bodyHtml` is deliberately NOT escaped
 *  here — it's documented as "already-built inner HTML," the caller's
 *  own responsibility (and `renderEntityCard`'s fields below are exactly
 *  how a caller is expected to safely build it). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const COLOR = {
  paper: "#f5f7fb",
  ink: "#182230",
  muted: "#667085",
  line: "#e2e6ef",
  pine: "#465bff",
  pineHover: "#3446db",
  subtle: "#eef2ff",
  pillBg: "#dbe3ff",
};

export type FooterLink = { label: string; url: string };

export type EmailLayoutParams = {
  eyebrow: string;
  headline: string;
  /** Already-built inner HTML: greeting, body copy, entity card(s). */
  bodyHtml: string;
  bodyText: string;
  cta?: { label: string; url: string };
  secondaryLink?: { label: string; url: string };
  /** Shown after a divider, only when set — the guest/no-account path's
   *  explanatory note in the reference design. */
  note?: string;
  /** The muted "why you're receiving this" footer line. */
  footerContext: string;
  footerLinks: FooterLink[];
};

export function emailLayout({
  eyebrow,
  headline,
  bodyHtml,
  bodyText,
  cta,
  secondaryLink,
  note,
  footerContext,
  footerLinks,
}: EmailLayoutParams): { html: string; text: string } {
  const ctaHtml = cta
    ? `<a href="${cta.url}" style="display:block;background:${COLOR.pine};color:#ffffff;text-align:center;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin:24px 0 12px;">${escapeHtml(cta.label)}</a>`
    : "";
  const secondaryHtml = secondaryLink
    ? `<p style="text-align:center;margin:0 0 20px;"><a href="${secondaryLink.url}" style="color:${COLOR.pine};font-size:14px;text-decoration:none;">${escapeHtml(secondaryLink.label)}</a></p>`
    : "";
  const noteHtml = note
    ? `<hr style="border:none;border-top:1px solid ${COLOR.line};margin:20px 0;" /><p style="font-size:13px;color:${COLOR.muted};line-height:1.6;margin:0 0 20px;">${escapeHtml(note)}</p>`
    : "";
  const footerLinksHtml = footerLinks
    .map((l) => `<a href="${l.url}" style="color:${COLOR.muted};text-decoration:underline;">${escapeHtml(l.label)}</a>`)
    .join(" &middot; ");

  const html = `
    <div style="background:${COLOR.paper};padding:32px 16px;font-family:sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${COLOR.line};">
        <div style="padding:32px 32px 8px;text-align:center;">
          <img src="${LOGO_URL}" width="140" height="56" alt="Just IT" style="display:block;margin:0 auto 24px;border:0;" />
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${COLOR.muted};margin-bottom:8px;">${escapeHtml(eyebrow)}</div>
          <h1 style="font-size:22px;font-weight:700;color:${COLOR.ink};margin:0 0 16px;line-height:1.3;">${escapeHtml(headline)}</h1>
        </div>
        <div style="padding:0 32px;">
          ${bodyHtml}
          ${ctaHtml}
          ${secondaryHtml}
          ${noteHtml}
        </div>
        <div style="padding:24px 32px 32px;">
          <hr style="border:none;border-top:1px solid ${COLOR.line};margin:0 0 20px;" />
          <div style="font-size:12px;color:${COLOR.muted};text-align:center;line-height:1.7;">
            ${escapeHtml(footerContext)}<br/>
            ${footerLinksHtml}
          </div>
        </div>
      </div>
    </div>
  `.trim();

  const textFooterLinks = footerLinks.map((l) => `${l.label}: ${l.url}`).join("\n");
  const text = [
    bodyText,
    cta ? `${cta.label}: ${cta.url}` : "",
    secondaryLink ? `${secondaryLink.label}: ${secondaryLink.url}` : "",
    note ?? "",
    "— Just IT",
    footerContext,
    textFooterLinks,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { html, text };
}

export type EntityCardParams = {
  logoUrl?: string | null;
  /** Shown in a colored square when `logoUrl` is unset. */
  initials: string;
  title: string;
  meta?: string;
  pill?: string | null;
  /** A real, truncated excerpt — e.g. a message body — rendered as a
   *  quoted line under the meta row. Never a fabricated preview. */
  quote?: string | null;
  /** Wraps the whole card in a link when set. */
  href?: string;
};

export function renderEntityCard({ logoUrl, initials, title, meta, pill, quote, href }: EntityCardParams): string {
  const logoCell = logoUrl
    ? `<img src="${logoUrl}" width="40" height="40" alt="" style="display:block;border-radius:8px;object-fit:cover;border:0;" />`
    : `<div style="width:40px;height:40px;border-radius:8px;background:${COLOR.pine};color:#ffffff;font-size:14px;font-weight:700;text-align:center;line-height:40px;">${escapeHtml(initials)}</div>`;

  const pillHtml = pill
    ? `<span style="display:inline-block;margin-top:8px;padding:2px 10px;border-radius:999px;background:${COLOR.pillBg};color:${COLOR.pine};font-size:12px;font-weight:600;">${escapeHtml(pill)}</span>`
    : "";
  const quoteHtml = quote
    ? `<div style="margin-top:10px;padding-left:10px;border-left:2px solid ${COLOR.pine};font-size:13px;color:${COLOR.ink};font-style:italic;line-height:1.5;">&ldquo;${escapeHtml(quote)}&rdquo;</div>`
    : "";

  const inner = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.subtle};border-radius:10px;margin:20px 0;">
      <tr>
        <td style="padding:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width:40px;vertical-align:top;padding-right:12px;">${logoCell}</td>
              <td style="vertical-align:top;">
                <div style="font-size:15px;font-weight:700;color:${COLOR.ink};">${escapeHtml(title)}</div>
                ${meta ? `<div style="font-size:13px;color:${COLOR.muted};margin-top:2px;">${escapeHtml(meta)}</div>` : ""}
                ${pillHtml}
                ${quoteHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();

  return href ? `<a href="${href}" style="text-decoration:none;display:block;">${inner}</a>` : inner;
}

export function entityCardText({ title, meta, pill, quote }: Pick<EntityCardParams, "title" | "meta" | "pill" | "quote">): string {
  return [title, meta, pill ? `[${pill}]` : "", quote ? `"${quote}"` : ""].filter(Boolean).join(" — ");
}
