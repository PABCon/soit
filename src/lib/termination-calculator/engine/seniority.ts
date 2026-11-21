const MS_PER_DAY = 86_400_000;
const PRE_2013_REFORM_CUTOFF = "2013-10-01";

export type SeniorityBreakdown = {
  /** Complete years elapsed between contractStartDate and asOfDate,
   *  computed by anniversary comparison (calendar-accurate, handles
   *  leap years correctly, unlike a fixed 365.25-day average). */
  fullYears: number;
  /** Days elapsed since the most recent anniversary, used to prorate
   *  the partial year (CT art. 366.º, n.º 2(d): "fraction of a year
   *  calculated proportionally"). */
  extraDays: number;
  /** `fullYears + extraDays/365`, the decimal interpretation this
   *  engine uses for proration. The law requires proportionality but
   *  doesn't specify the exact day-count denominator; 365 is this
   *  engine's documented, reasonable convention, not a cited figure. */
  yearsDecimal: number;
  /** True if the contract started before 1 October 2013: the pre-reform
   *  transitional regime (Lei n.º 69/2013, segmented day-rates per
   *  tenure slice) is explicitly NOT implemented in this engine. Every
   *  calculation that depends on a single day-rate must check this flag
   *  first and refuse to produce a number rather than silently using the
   *  post-2013 rate for pre-2013 tenure. */
  isPreOct2013: boolean;
};

/** Shared by severance.ts, fixed-term.ts, and proportionals.ts so tenure
 *  is computed identically everywhere in this engine, never duplicated
 *  date math that could quietly drift between modules. */
export function calculateSeniority(contractStartDate: string, asOfDate: string): SeniorityBreakdown {
  const start = new Date(`${contractStartDate}T00:00:00Z`);
  const asOf = new Date(`${asOfDate}T00:00:00Z`);

  let fullYears = asOf.getUTCFullYear() - start.getUTCFullYear();
  let lastAnniversary = new Date(Date.UTC(start.getUTCFullYear() + fullYears, start.getUTCMonth(), start.getUTCDate()));
  if (lastAnniversary.getTime() > asOf.getTime()) {
    fullYears -= 1;
    lastAnniversary = new Date(Date.UTC(start.getUTCFullYear() + fullYears, start.getUTCMonth(), start.getUTCDate()));
  }
  const extraDays = Math.max(0, Math.round((asOf.getTime() - lastAnniversary.getTime()) / MS_PER_DAY));

  return {
    fullYears: Math.max(0, fullYears),
    extraDays,
    yearsDecimal: Math.max(0, fullYears) + extraDays / 365,
    isPreOct2013: start.getTime() < new Date(`${PRE_2013_REFORM_CUTOFF}T00:00:00Z`).getTime(),
  };
}

/** Complete calendar months actually worked within the calendar year
 *  containing `asOfDate`, the base for proportional holiday/Christmas-
 *  subsidy entitlements (CT art. 245.º). Counts from `contractStartDate`
 *  if the worker was hired during that same calendar year, otherwise
 *  from 1 January of that year. */
export function fullMonthsInCessationYear(contractStartDate: string, asOfDate: string): number {
  const start = new Date(`${contractStartDate}T00:00:00Z`);
  const asOf = new Date(`${asOfDate}T00:00:00Z`);
  const cessationYear = asOf.getUTCFullYear();
  const yearStart =
    start.getUTCFullYear() === cessationYear ? start : new Date(Date.UTC(cessationYear, 0, 1));

  let months = (asOf.getUTCFullYear() - yearStart.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - yearStart.getUTCMonth());
  // Only count a month as "complete" once the same day-of-month (or
  // later) has been reached, same anniversary logic as calculateSeniority.
  if (asOf.getUTCDate() < yearStart.getUTCDate()) months -= 1;
  return Math.max(0, months);
}
