import type { ReactNode } from "react";

export type BadgeVariant = "topEmployer" | "boosted" | "new" | "warning" | "match";

// Round-10 full-fidelity sweep against the Design System Showcase: the
// reference's own "Badge: Top Employer" swatch (sampled directly, pixel
// level) uses dark amber/brown text on its solid amber fill, not navy
// `text-ink` — this codebase had THREE independent copies of this exact
// badge (JobRow's feed card, the job detail page, CompanyProfileBody),
// each hand-rolled with its own slightly different recipe (two different
// background opacities, one genuinely different color family for
// "Boosted" on the detail page — plain Tailwind violet instead of the
// round-7-corrected `mint` token). One shared component now, per the
// standing instruction: a repeated element gets fixed everywhere it
// appears, not just where it was reported.
const VARIANTS: Record<BadgeVariant, string> = {
  topEmployer: "bg-warning text-amber-900",
  warning: "bg-warning text-amber-900",
  boosted: "bg-mint/15 text-mint",
  new: "bg-subtle text-pine",
  match: "bg-pine/10 text-pine",
};

export function Badge({
  variant,
  size = "md",
  className = "",
  children,
}: {
  variant: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-xs leading-4";
  return (
    <span className={`rounded font-medium tracking-wide uppercase ${sizeClasses} ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  );
}
