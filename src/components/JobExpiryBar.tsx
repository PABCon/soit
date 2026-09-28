/** Percent of a job's listing window still remaining — a plain helper, not
 *  a component, since `Date.now()` is impure and React's purity rule
 *  (rightly) flags calling it directly inside a component's render body. */
export function expiryPercentLeft(publishedAt: string, expiresAt: string): number | null {
  const published = new Date(publishedAt).getTime();
  const expires = new Date(expiresAt).getTime();
  const total = expires - published;
  if (total <= 0) return null;

  const elapsed = Date.now() - published;
  return Math.max(0, Math.min(100, 100 - (elapsed / total) * 100));
}

/** A slim "days left" progress bar (§ real-usage QA, item 10c — matches
 *  the reference screenshot's own gradient bar under the Apply button).
 *  Purely presentational — the caller computes `percentLeft` via
 *  `expiryPercentLeft()` from data the job detail page already has. */
export function JobExpiryBar({ percentLeft }: { percentLeft: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full bg-gradient-to-r from-pine to-mint transition-[width]"
        style={{ width: `${percentLeft}%` }}
      />
    </div>
  );
}
