/** Tech stack chips. Values come from the controlled vocabulary (§5.6). */
export function TechTags({ tech, max }: { tech: string[]; max?: number }) {
  const shown = max ? tech.slice(0, max) : tech;
  const rest = max ? tech.length - shown.length : 0;

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {shown.map((t) => (
        <li
          key={t}
          className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-muted"
        >
          {t}
        </li>
      ))}
      {rest > 0 && <li className="text-xs text-muted">+{rest}</li>}
    </ul>
  );
}
