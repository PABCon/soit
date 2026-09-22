import type { Company } from "@/lib/types";

const SIZES = {
  sm: "h-10 w-10 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

// A small fixed palette, deterministically picked from the name — stable
// across renders/requests without needing to store a color anywhere.
const PALETTE = ["#0C6B58", "#2D5BA8", "#8A3D5F", "#B4622A", "#3F5E48", "#5B4B8A"];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Real logo when uploaded (§5.1); otherwise an initials tile in a colour
 *  deterministically derived from the company name. */
export function CompanyLogo({
  company,
  size = "md",
  shape = "rounded",
}: {
  company: Company;
  size?: keyof typeof SIZES;
  /** "circle" overlaps a banner with a white ring — the public company page's header. */
  shape?: "rounded" | "circle";
}) {
  const shapeClass = shape === "circle" ? "rounded-full ring-4 ring-paper" : "rounded-xl";

  if (company.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URLs, not local assets.
      <img
        src={company.logoUrl}
        alt=""
        className={`${SIZES[size]} ${shapeClass} shrink-0 object-cover`}
      />
    );
  }

  const initials = company.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: colorFor(company.name) }}
      className={`${SIZES[size]} ${shapeClass} flex shrink-0 items-center justify-center font-display font-bold text-white`}
    >
      {initials}
    </div>
  );
}
