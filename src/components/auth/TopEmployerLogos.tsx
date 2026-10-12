import { Link } from "@/i18n/navigation";
import type { TopEmployerLogo } from "@/lib/db/companies";

/** Round 21's employer-signup trust section — real, currently-subscribed
 *  Top Employer companies only (`top_employer_active`, a real logo set),
 *  never a static/fabricated logo list. Omitted entirely when none
 *  qualify, same "omit when the real data doesn't support it" convention
 *  as every other optional section in this app (company-profile cards,
 *  the jobs page's "browse by" sections). */
export function TopEmployerLogos({
  companies,
  trustHeadline,
  viewAllCompanies,
}: {
  companies: TopEmployerLogo[];
  trustHeadline: string;
  viewAllCompanies: string;
}) {
  if (companies.length === 0) return null;

  return (
    <div className="border-t border-line pt-6">
      <p className="mb-3 text-sm font-semibold text-ink">{trustHeadline}</p>
      <div className="flex flex-wrap gap-3">
        {companies.map((c) => (
          <Link
            key={c.slug}
            href={`/companies/${c.slug}`}
            className="flex h-14 w-28 items-center justify-center rounded-lg border border-line bg-white p-2 transition-colors hover:border-pine"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a company-supplied logo URL, not a local/optimizable asset */}
            <img src={c.logoUrl} alt={c.name} className="max-h-full max-w-full object-contain" />
          </Link>
        ))}
      </div>
      <Link href="/companies" className="mt-3 inline-block text-sm font-medium text-pine hover:underline">
        {viewAllCompanies} →
      </Link>
    </div>
  );
}
