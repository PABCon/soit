/**
 * Stored XSS defense (security audit finding, 2026-10-28): every
 * `<script type="application/ld+json">` in this app builds its content via
 * `JSON.stringify(...)`, fed straight into `dangerouslySetInnerHTML`.
 * `JSON.stringify` does NOT escape `<` — a job title/description or
 * company name/description containing a literal `</script>` (employer-
 * authored via the console form, or AI-extracted verbatim from a scraped
 * third-party posting with no character filtering) breaks out of the
 * script tag and injects arbitrary HTML into the page for every visitor.
 * `<` is a valid JSON string escape for `<` — semantically identical
 * once parsed, but never closes an HTML tag while still inside the
 * `<script>` element's raw text.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
