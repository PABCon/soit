import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-pine text-white hover:bg-pine-hover",
  secondary: "border border-pine text-pine bg-white hover:bg-subtle",
  ghost: "text-pine hover:text-pine-hover",
  danger: "border border-error text-error bg-white hover:bg-error/5",
};

// Round-9 item 1: these used to be hardcoded straight into BASE below, and
// every caller that wanted a different size (the Search button) overrode
// them via a second, conflicting className instead of picking a real size
// — two same-named Tailwind utilities (h-11 vs h-14, px-4 vs px-6, text-sm
// vs text-base) on one element race in the generated stylesheet, and which
// one wins isn't guaranteed per-property (confirmed live: the Search button
// was rendering at the *right* height but the *wrong* font-size from this
// exact conflict). `size` is now a real, first-class variant instead.
const SIZES: Record<Size, string> = {
  md: "h-11 px-4 text-sm",
  lg: "h-14 px-6 text-base",
};

const BASE = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50";

/** Exported so a non-`<button>` element meant to look identical (e.g.
 *  `LoginMenu`'s "Add offer", a navigation `Link`) can share the exact
 *  same recipe instead of hand-copying it and silently drifting the next
 *  time this component changes — the root cause of this literally being
 *  reported three times before. */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
}

/**
 * Design-system reference image (3rd landing-page pass): a literal
 * "Components" swatch sheet names four distinct button treatments —
 * Primary (solid), Secondary (outline), Ghost (icon+text, no border/fill)
 * and Danger/Action (red outline) — none of which had a single shared
 * component before this; each was a one-off className on its own button
 * (the Search button, "More filters," "Save search," "Clear all"). Built
 * once here and reused across all four rather than left as ad hoc,
 * independently-drifting treatments.
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={buttonClassName({ variant, size, className })} {...rest}>
      {children}
    </button>
  );
}
