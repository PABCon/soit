import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getGrowthMetrics, type ClientStatus } from "@/lib/db/growth-metrics";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ key?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Growth metrics", robots: { index: false, follow: false } };
}

const STATUS_LABEL: Record<ClientStatus, string> = {
  active: "Active",
  dormant: "Dormant",
  never_activated: "Never activated",
};
const STATUS_COLOR: Record<ClientStatus, string> = {
  active: "var(--color-pine)",
  dormant: "#b45309",
  never_activated: "var(--color-muted)",
};

function formatEur(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "EUR" });
}

/** Internal, owner-only business-health dashboard ("going to market" ask):
 *  real candidate/company/job/revenue counts, gated the same lightweight
 *  way `/assistant-stats` already is (its own doc comment explains why
 *  there's no admin role/panel in this codebase yet), a shared secret
 *  read from the URL, 404 on anything else. Deliberately its own secret
 *  (`GROWTH_METRICS_SECRET`), not `ASSISTANT_STATS_SECRET`: a leak of one
 *  internal tool's link shouldn't also expose this one. The data itself
 *  is real and unredacted (company names, revenue), the protection is
 *  entirely "nobody can open the page without the key," not sanitizing
 *  what an authorized viewer (you) sees. */
export default async function GrowthMetricsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { key } = await searchParams;
  setRequestLocale(locale);

  const expected = process.env.GROWTH_METRICS_SECRET;
  if (!expected || key !== expected) notFound();

  const data = await getGrowthMetrics();

  const width = 640;
  const height = 160;
  const padding = 24;
  const maxValue = Math.max(1, ...data.signupTrend.map((p) => Math.max(p.candidates, p.companies)));
  const stepX = data.signupTrend.length > 1 ? (width - padding * 2) / (data.signupTrend.length - 1) : 0;
  function coords(key: "candidates" | "companies") {
    return data.signupTrend
      .map((p, i) => {
        const x = padding + i * stepX;
        const y = height - padding - (p[key] / maxValue) * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-xl font-bold text-ink">Growth metrics</h1>
      <p className="mt-1 text-sm text-muted">Platform-wide, real-time. Not for sharing.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Candidates", value: data.totals.candidates },
          { label: "Verified companies", value: data.totals.verifiedCompanies },
          { label: "Live jobs", value: data.totals.liveJobs },
          { label: "Applications (ever)", value: data.totals.applicationsEver },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs text-muted">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          { label: "New candidates (30d)", value: data.newLast30Days.candidates },
          { label: "New verified cos. (30d)", value: data.newLast30Days.verifiedCompanies },
          { label: "Jobs published (30d)", value: data.newLast30Days.jobsPublished },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-white p-3">
            <p className="text-xs text-muted">{card.label}</p>
            <p className="mt-1 text-lg font-bold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">New candidates vs. new companies (last 30 days)</p>
        <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" role="img" aria-label="New candidates and new companies per day">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-line)" strokeWidth="1" />
          <polyline points={coords("candidates")} fill="none" stroke="var(--color-pine)" strokeWidth="2.5" />
          <polyline points={coords("companies")} fill="none" stroke="var(--color-mint)" strokeWidth="2.5" />
        </svg>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-pine)" }} aria-hidden="true" />
            Candidates
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-mint)" }} aria-hidden="true" />
            Companies
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">Companies by status</p>
        <ul className="mt-2 space-y-1.5">
          {Object.entries(data.companiesByStatus).map(([status, count]) => (
            <li key={status} className="flex items-center justify-between text-sm">
              <span className="text-ink capitalize">{status}</span>
              <span className="text-muted">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">Clients (verified companies)</p>
        <p className="mt-0.5 text-xs text-muted">
          Active = at least one live job right now. Dormant = published before, nothing live now. Never activated = verified but never published.
        </p>
        {data.clients.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No verified companies yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-1.5 font-medium">Company</th>
                <th className="pb-1.5 font-medium">Status</th>
                <th className="pb-1.5 font-medium">Live jobs</th>
                <th className="pb-1.5 font-medium">Last published</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((c) => (
                <tr key={c.companyId} className="border-t border-line">
                  <td className="py-1.5 text-ink">{c.companyName}</td>
                  <td className="py-1.5">
                    <span className="font-medium" style={{ color: STATUS_COLOR[c.status] }}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="py-1.5 text-ink">{c.liveJobCount}</td>
                  <td className="py-1.5 text-muted">{c.lastPublishedAt ? c.lastPublishedAt.slice(0, 10) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">Pipeline: companies that should claim their account</p>
        <p className="mt-0.5 text-xs text-muted">Scraped + drafted (§claim-invites), awaiting an owner to actually claim the profile.</p>
        {data.prospects.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No open prospects right now.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-1.5 font-medium">Company</th>
                <th className="pb-1.5 font-medium">Added</th>
                <th className="pb-1.5 font-medium">Claim link expires</th>
              </tr>
            </thead>
            <tbody>
              {data.prospects.map((p) => (
                <tr key={p.companyId} className="border-t border-line">
                  <td className="py-1.5 text-ink">{p.companyName}</td>
                  <td className="py-1.5 text-muted">{p.createdAt.slice(0, 10)}</td>
                  <td className="py-1.5 text-muted">{p.claimExpiresAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="text-xs text-muted">Ad-credit revenue (lifetime)</p>
          <p className="mt-1 text-lg font-bold text-ink">{formatEur(data.billing.adCreditRevenueCents)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="text-xs text-muted">Active Top Employer subs</p>
          <p className="mt-1 text-lg font-bold text-ink">{data.billing.activeTopEmployerCount}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="text-xs text-muted">Companies that ever paid</p>
          <p className="mt-1 text-lg font-bold text-ink">{data.billing.everPaidCompanyCount}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="text-xs text-muted">Favorites saved</p>
          <p className="mt-1 text-lg font-bold text-ink">{data.totals.favorites}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="text-xs text-muted">Saved searches</p>
          <p className="mt-1 text-lg font-bold text-ink">{data.totals.savedSearches}</p>
        </div>
      </div>
    </div>
  );
}
