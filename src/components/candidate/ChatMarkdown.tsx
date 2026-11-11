import type { ReactNode } from "react";

type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };

/** Same parsing approach as `JobDescriptionBody.tsx`'s own
 *  `parseDescriptionBlocks` (a plain `<p>` collapses the model's own
 *  `\n`-separated lines per normal HTML whitespace rules, so the
 *  structure exists in the string but is invisible on the page):
 *  "-"/"*"-prefixed lines become a real `<ul>`, everything else a
 *  paragraph. Real-usage bug: the assistant's own replies (job
 *  comparisons, bulleted breakdowns) were rendering as one long run-on
 *  line with literal "- **Salary:** ..." text, not actual structure. */
function parseChatBlocks(text: string): Block[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  const blocks: Block[] = [];

  for (const para of paragraphs) {
    const lines = para
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let currentList: string[] | null = null;
    let currentPara: string[] | null = null;

    for (const line of lines) {
      const bulletMatch = /^[-*]\s+(.*)/.exec(line);
      if (bulletMatch) {
        if (currentPara) {
          blocks.push({ type: "p", text: currentPara.join(" ") });
          currentPara = null;
        }
        (currentList ??= []).push(bulletMatch[1]);
      } else {
        if (currentList) {
          blocks.push({ type: "ul", items: currentList });
          currentList = null;
        }
        (currentPara ??= []).push(line);
      }
    }
    if (currentList) blocks.push({ type: "ul", items: currentList });
    if (currentPara) blocks.push({ type: "p", text: currentPara.join(" ") });
  }

  return blocks;
}

/** The model's own replies reliably use `**bold**` for field labels
 *  ("**Salary:**"), rendered literally before this fix. Only `**bold**`
 *  is handled (the one inline style actually observed in real
 *  responses), not a full markdown grammar. */
function renderInline(text: string, keyPrefix: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const match = /^\*\*(.+)\*\*$/.exec(part);
    return match ? <strong key={`${keyPrefix}-${i}`}>{match[1]}</strong> : <span key={`${keyPrefix}-${i}`}>{part}</span>;
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
        ) : (
          <p key={i}>{renderInline(block.text, `${i}`)}</p>
        ),
      )}
    </div>
  );
}
