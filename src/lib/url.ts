/** Normalizes a user-entered website URL so it always has a protocol —
 *  typing "google.com" should work, not require "https://google.com".
 *  Real-usage report: a bare domain was being stored and rendered as
 *  `href="google.com"` on the public company page, which a browser
 *  resolves as a *relative* path against the current page (justit.pt/
 *  google.com) rather than an external link — silently broken, not
 *  rejected, which is why it looked like "https://" was being required.
 *  Applied both when saving (new data stays well-formed) and when
 *  rendering (covers any already-stored bare-domain values without a
 *  backfill migration). */
export function normalizeWebsiteUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
