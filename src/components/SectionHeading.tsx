import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** The icon-circle-before-heading idiom the matchmaking candidate-profile
 *  page's reference design uses for every major section (AI summary,
 *  Skills, Experience) — `AiSummaryPanel` renders its own equivalent
 *  internally; this covers the plain `<h2>` sections around it so every
 *  section on the page (and its applicant-detail twin) reads consistently. */
export function SectionHeading({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle">
        <Icon className="h-3.5 w-3.5 text-pine" aria-hidden="true" />
      </span>
      <h2 className="font-display text-sm font-semibold text-muted">{children}</h2>
    </div>
  );
}
