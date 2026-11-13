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

/**
 * AI/answer-engine audit finding: no page used `FAQPage` schema, one of
 * the strongest known signals for being pulled into an AI-generated
 * answer or Google's "People also ask." Shared across every guide page
 * that already has genuine term/explanation content: the question text
 * passed in should read naturally as a question even where the page's
 * own visible heading is a short label rather than a literal "What is…"
 * (Google's own FAQ guidelines only require the *answer* to be real,
 * visible page content, which every caller of this already guarantees:
 * the exact same string shown on the page, never paraphrased or
 * invented for the schema alone). */
export function faqPageJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
