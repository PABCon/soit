import type { AnalyticsTrendPoint } from "@/lib/db/job-analytics";

/** A plain, dependency-free inline SVG line chart — same "no new charting
 *  library" discipline the blog content work already established
 *  (`scripts/generate-blog-chart.ts`'s own bar charts). Unlike that
 *  standalone script, this renders inside the real app, so it reads the
 *  actual design-system CSS custom properties (`var(--color-pine)`) for
 *  its two lines instead of hardcoding hex literals, staying in sync
 *  with the palette automatically rather than drifting from it. */
export function AnalyticsTrendChart({
  trend,
  viewsLabel,
  applyClicksLabel,
}: {
  trend: AnalyticsTrendPoint[];
  viewsLabel: string;
  applyClicksLabel: string;
}) {
  const width = 640;
  const height = 180;
  const padding = 28;
  const maxValue = Math.max(1, ...trend.map((p) => Math.max(p.views, p.applyClicks)));
  const stepX = trend.length > 1 ? (width - padding * 2) / (trend.length - 1) : 0;

  function coords(key: "views" | "applyClicks") {
    return trend
      .map((p, i) => {
        const x = padding + i * stepX;
        const y = height - padding - (p[key] / maxValue) * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const firstDate = trend[0]?.date;
  const lastDate = trend[trend.length - 1]?.date;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`${viewsLabel} / ${applyClicksLabel}`}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-line)" strokeWidth="1" />
        <polyline points={coords("views")} fill="none" stroke="var(--color-pine)" strokeWidth="2.5" />
        <polyline points={coords("applyClicks")} fill="none" stroke="var(--color-mint)" strokeWidth="2.5" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{firstDate}</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-pine)" }} aria-hidden="true" />
            {viewsLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-mint)" }} aria-hidden="true" />
            {applyClicksLabel}
          </span>
        </div>
        <span>{lastDate}</span>
      </div>
    </div>
  );
}
