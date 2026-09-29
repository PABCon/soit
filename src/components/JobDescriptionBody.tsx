type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };

/**
 * Real-usage feedback: `extract-job.ts`'s description now preserves the
 * source's own paragraph/bullet structure (§ formatting fix), but a plain
 * `<p>{text}</p>` collapses single `\n` line breaks per normal HTML
 * whitespace rules — the structure would be in the string but invisible
 * on the page. Parses "- "/"* "-prefixed lines into real `<ul>` lists and
 * everything else into paragraphs, so a candidate actually sees the
 * Requirements/Responsibilities/Benefits structure a real posting has,
 * not a wall of text.
 */
function parseDescriptionBlocks(description: string): Block[] {
  const paragraphs = description.split(/\n{2,}/).filter((p) => p.trim());
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

export function JobDescriptionBody({ description }: { description: string }) {
  const blocks = parseDescriptionBlocks(description);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted">
      {blocks.map((block, i) =>
        block.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{block.text}</p>
        ),
      )}
    </div>
  );
}
