import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAssistantAnalytics } from "@/lib/db/assistant-analytics";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ key?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "JT usage", robots: { index: false, follow: false } };
}

/** A minimal internal stats page for the chat assistant's usage data:
 *  "how do we track usage" answered with the same mechanism every other
 *  analytics feature in this project already uses (the `events` table +
 *  logEvent(), see src/app/api/assistant/route.ts), rather than new
 *  tracking infrastructure. There's no admin role or panel anywhere in
 *  this codebase yet (a known, deliberately-deferred gap, documented
 *  elsewhere as its own future project) and this is platform-wide data,
 *  not scoped to one employer's own console, so rather than invent an
 *  admin system for one page, this is gated the same lightweight way the
 *  cron routes already are (a shared secret), just read from the URL
 *  instead of an Authorization header since a human visits this in a
 *  browser. Bookmark the URL with the real key once it's set. */
export default async function AssistantStatsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { key } = await searchParams;
  setRequestLocale(locale);

  const expected = process.env.ASSISTANT_STATS_SECRET;
  if (!expected || key !== expected) notFound();

  const tjf = await getTranslations({ locale, namespace: "jobForm" });
  const data = await getAssistantAnalytics();
  const zeroResultRate = data.totals.searches > 0 ? Math.round((data.totals.zeroResultSearches / data.totals.searches) * 100) : 0;

  const width = 640;
  const height = 160;
  const padding = 24;
  const maxValue = Math.max(1, ...data.trend.map((p) => Math.max(p.messages, p.searches)));
  const stepX = data.trend.length > 1 ? (width - padding * 2) / (data.trend.length - 1) : 0;
  function coords(key: "messages" | "searches") {
    return data.trend
      .map((p, i) => {
        const x = padding + i * stepX;
        const y = height - padding - (p[key] / maxValue) * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-xl font-bold text-ink">JT usage</h1>
      <p className="mt-1 text-sm text-muted">Chat assistant usage, last 30 days.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Sessions", value: data.totals.sessions },
          { label: "Messages sent", value: data.totals.messages },
          { label: "Searches run", value: data.totals.searches },
          { label: "Zero-result searches", value: `${zeroResultRate}%` },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs text-muted">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">Daily trend</p>
        {data.trackingStartedAt && (
          <p className="mt-0.5 text-xs text-muted">Tracking began {data.trackingStartedAt}, chart starts there.</p>
        )}
        <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" role="img" aria-label="Messages and searches per day">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-line)" strokeWidth="1" />
          <polyline points={coords("messages")} fill="none" stroke="var(--color-pine)" strokeWidth="2.5" />
          <polyline points={coords("searches")} fill="none" stroke="var(--color-mint)" strokeWidth="2.5" />
        </svg>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-pine)" }} aria-hidden="true" />
            Messages
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-mint)" }} aria-hidden="true" />
            Searches
          </span>
        </div>
      </div>

      {data.topCategories.length > 0 && (
        <div className="mt-6 rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Top searched categories</p>
          <ul className="mt-2 space-y-1.5">
            {data.topCategories.map((c) => (
              <li key={c.slug} className="flex items-center justify-between text-sm">
                <span className="text-ink">{tjf(`categoryOption.${c.slug}`)}</span>
                <span className="text-muted">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
