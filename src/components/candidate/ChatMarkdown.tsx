import type { ReactNode } from "react";

type Block = { type: "p"; text: string } | { type: "ul"; items: string[] } | { type: "ol"; items: string[] };

/** Same parsing approach as `JobDescriptionBody.tsx`'s own
 *  `parseDescriptionBlocks` (a plain `<p>` collapses the model's own
 *  `\n`-separated lines per normal HTML whitespace rules, so the
 *  structure exists in the string but is invisible on the page):
 *  "-"/"*"-prefixed lines become a real `<ul>`, "1."-style lines become
 *  a real `<ol>`, everything else a paragraph. Real-usage bug: the
 *  assistant's own replies (job comparisons, step-by-step breakdowns)
 *  were rendering as one long run-on line with literal
 *  "- **Salary:** ..." or "1. First, ..." text, not actual structure. */
function parseChatBlocks(text: string): Block[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  const blocks: Block[] = [];

  for (const para of paragraphs) {
    const lines = para
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let currentList: string[] | null = null;
    let currentListType: "ul" | "ol" | null = null;
    let currentPara: string[] | null = null;

    function flushList() {
      if (currentList && currentListType) blocks.push({ type: currentListType, items: currentList });
      currentList = null;
      currentListType = null;
    }

    for (const line of lines) {
      const bulletMatch = /^[-*]\s+(.*)/.exec(line);
      const numberedMatch = /^\d+[.)]\s+(.*)/.exec(line);
      const listType = bulletMatch ? "ul" : numberedMatch ? "ol" : null;
      const match = bulletMatch ?? numberedMatch;

      if (listType && match) {
        if (currentPara) {
          blocks.push({ type: "p", text: currentPara.join(" ") });
          currentPara = null;
        }
        // A switch from "-" items to "1." items (or vice versa) closes
        // the current list rather than merging unlike markers together.
        if (currentListType && currentListType !== listType) flushList();
        currentListType = listType;
        (currentList ??= []).push(match[1]);
      } else {
        flushList();
        (currentPara ??= []).push(line);
      }
    }
    flushList();
    if (currentPara) blocks.push({ type: "p", text: currentPara.join(" ") });
  }

  return blocks;
}

/** The model's own replies reliably use `**bold**` for field labels
 *  ("**Salary:**") and occasionally `[text](url)` links; both rendered
 *  literally before this fix. Deliberately still not a full markdown
 *  grammar, just the inline styles actually observed in real responses. */
function renderInline(text: string, keyPrefix: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const boldMatch = /^\*\*(.+)\*\*$/.exec(part);
    if (boldMatch) return <strong key={`${keyPrefix}-${i}`}>{boldMatch[1]}</strong>;
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (linkMatch) {
      return (
        <a key={`${keyPrefix}-${i}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="underline">
          {linkMatch[1]}
        </a>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

export function ChatMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseChatBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, i) =>
        block.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, `${i}-${j}`)}</li>
            ))}
          </ul>
        ) : block.type === "ol" ? (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, `${i}-${j}`)}</li>
            ))}
          </ol>
        ) : (
          <p key={i}>{renderInline(block.text, `${i}`)}</p>
        ),
      )}
    </div>
  );
}
