import type { LucideIcon } from "lucide-react";

/** Shared visual shape for every "AI summarizes this person's fit"
 *  surface in the console — originally the applicant detail page's own
 *  synopsis card, extracted and reused (round 26) by the matchmaking
 *  candidate profile page so the two read as the same feature rather
 *  than two independently-styled ones. Purely presentational: callers
 *  own their own translated copy, data fetching, and server action. */
export type AiSummarySection = {
  label: string;
  items: string[];
  icon: "plus" | "minus" | "check";
  toneClassName: string;
};

export function AiSummaryPanel({
  heading,
  icon: Icon,
  summaryLabel,
  summary,
  sections,
  generateCta,
  regenerateCta,
  generatingText,
  pending,
  onGenerate,
  error,
}: {
  heading: string;
  /** Optional icon shown in a small circle before the heading — the
   *  reference design's own convention for every major section on this
   *  page (AI summary/Skills/Experience each get one); omit for a caller
   *  that doesn't want the icon treatment. */
  icon?: LucideIcon;
  /** Optional sub-label shown above the summary paragraph itself (the
   *  reference's own "Profile summary" sub-heading) — omit for a surface
   *  that just wants the paragraph directly under the main heading. */
  summaryLabel?: string;
  summary: string | null;
  sections: AiSummarySection[];
  generateCta: string;
  regenerateCta: string;
  generatingText: string;
  pending: boolean;
  onGenerate: () => void;
  error: string | null;
}) {
  const headingRow = (
    <div className="flex items-center gap-2">
      {Icon && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle">
          <Icon className="h-3.5 w-3.5 text-pine" aria-hidden="true" />
        </span>
      )}
      <h2 className="font-display text-sm font-semibold text-muted">{heading}</h2>
    </div>
  );

  if (!summary) {
    return (
      <section>
        {headingRow}
        <button
          type="button"
          disabled={pending}
          onClick={onGenerate}
          className="mt-2 flex h-9 items-center rounded-lg border border-pine px-3 text-sm font-medium text-pine hover:bg-pine/5 disabled:opacity-50"
        >
          {pending ? generatingText : generateCta}
        </button>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        {headingRow}
        <button
          type="button"
          disabled={pending}
          onClick={onGenerate}
          className="text-xs font-medium text-pine hover:underline disabled:opacity-50"
        >
          {pending ? generatingText : regenerateCta}
        </button>
      </div>
      {summaryLabel && <p className="mt-3 text-xs font-semibold text-muted uppercase">{summaryLabel}</p>}
      <p className={`${summaryLabel ? "mt-1" : "mt-2"} text-sm leading-relaxed text-ink`}>{summary}</p>

      {sections.map(
        (section) =>
          section.items.length > 0 && (
            <div key={section.label} className="mt-3">
              <p className={`text-xs font-semibold uppercase ${section.toneClassName}`}>{section.label}</p>
              <ul className="mt-1 space-y-1">
                {section.items.map((point, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm text-ink">
                    <span aria-hidden className={section.toneClassName}>
                      {section.icon === "plus" ? "+" : section.icon === "minus" ? "−" : "✓"}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
