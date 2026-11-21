import type { ReactNode } from "react";

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

/** GFM pipe-table row detection/parsing — the model reliably formats
 *  job comparisons as real markdown tables; real-usage bug: with no
 *  table handling at all, every row fell into the plain-paragraph
 *  branch below and rendered as one literal "| Vaga | Salário |..."
 *  line. */
function isTableRow(line: string): boolean {
  return /^\|.*\|$/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

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
    let currentTableLines: string[] | null = null;

    function flushList() {
      if (currentList && currentListType) blocks.push({ type: currentListType, items: currentList });
      currentList = null;
      currentListType = null;
    }

    function flushTable() {
      if (!currentTableLines) return;
      // A real table needs a header row + a valid separator row; a lone
      // pipe-looking line (or a header with no separator after it) isn't
      // actually a table, so it falls back to plain text rather than
      // silently vanishing.
      if (currentTableLines.length >= 2 && isSeparatorRow(currentTableLines[1])) {
        blocks.push({
          type: "table",
          headers: splitTableRow(currentTableLines[0]),
          rows: currentTableLines.slice(2).map(splitTableRow),
        });
      } else {
        blocks.push({ type: "p", text: currentTableLines.join(" ") });
      }
      currentTableLines = null;
    }

    for (const line of lines) {
      if (isTableRow(line)) {
        if (currentPara) {
          blocks.push({ type: "p", text: currentPara.join(" ") });
          currentPara = null;
        }
        flushList();
        (currentTableLines ??= []).push(line);
        continue;
      }
      flushTable();

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
    flushTable();
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
        ) : block.type === "table" ? (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  {block.headers.map((h, j) => (
                    <th key={j} className="border-b border-line px-2 py-1.5 font-semibold whitespace-nowrap text-ink">
                      {renderInline(h, `${i}-h-${j}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, j) => (
                  <tr key={j}>
                    {row.map((cell, k) => (
                      <td key={k} className="border-b border-line px-2 py-1.5 align-top">
                        {renderInline(cell, `${i}-${j}-${k}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p key={i}>{renderInline(block.text, `${i}`)}</p>
        ),
      )}
    </div>
  );
}
