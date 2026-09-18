import type { Company } from "@/lib/jobs";

const SIZES = { sm: "h-10 w-10 text-xs", md: "h-12 w-12 text-sm", lg: "h-16 w-16 text-lg" };

/** Initials tile standing in for an uploaded logo until Storage lands (§5.1). */
export function CompanyLogo({
  company,
  size = "md",
}: {
  company: Company;
  size?: keyof typeof SIZES;
}) {
  const initials = company.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: company.color }}
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-xl font-display font-bold text-white`}
    >
      {initials}
    </div>
  );
}
