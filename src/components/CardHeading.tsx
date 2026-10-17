import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Icon-circle card header idiom — pairs the matchmaking/applicant pages'
 *  icon-circle treatment with the employer console's established
 *  `rounded-xl border border-line bg-white p-6` card + `h2`/subtitle
 *  recipe (`EmployerProfileForm`, `CompanyProfileForm`'s sub-sections),
 *  for the candidate-side design-consistency pass. `tone="danger"` tints
 *  the icon circle red for destructive sections (e.g. delete account). */
export function CardHeading({
  icon: Icon,
  title,
  subtitle,
  action,
  tone = "default",
}: {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            tone === "danger" ? "bg-red-50" : "bg-subtle"
          }`}
        >
          <Icon className={`h-4 w-4 ${tone === "danger" ? "text-red-700" : "text-pine"}`} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
