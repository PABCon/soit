/**
 * Real-usage feedback: the original blunt tag-strip collapsed every tag to
 * a single space, which destroyed paragraph/list structure *before* the
 * model ever saw the text — no amount of prompt instruction can recover
 * structure that's already gone. This still isn't a readability library,
 * but it now converts block/list boundaries to real newlines (and `<li>`
 * to a `- ` bullet marker) first, so a source page's own paragraph and
 * list breaks survive into the prompt for the model to reproduce.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
