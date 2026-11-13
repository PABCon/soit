/** Shared input, collected once regardless of which scenario the
 *  candidate picks, mirrors salary-calculator's own `Profile` pattern. */
export type TerminationProfile = {
  /** Base monthly remuneration + diuturnidades (CT art. 366.º's own
   *  definition of the figure every formula here is built from). */
  monthlyRemuneration: number;
  /** ISO date (YYYY-MM-DD) the employment contract started. */
  contractStartDate: string;
  /** ISO date (YYYY-MM-DD) the contract ends/ended, "today" for a
   *  what-if calculation, the real date for an already-decided one. */
  cessationDate: string;
};

export type ProportionalEntitlementsInput = {
  profile: TerminationProfile;
  /** Accrued-but-untaken holiday days carried over from a prior year, if
   *  any (CT art. 245.º: owed in full regardless of termination type). */
  unusedPriorYearHolidayDays?: number;
};

export type ProportionalEntitlementsResult = {
  fullMonthsWorkedInCessationYear: number;
  proportionalHolidayDays: number;
  proportionalHolidayPay: number;
  proportionalChristmasSubsidy: number;
  unusedPriorYearHolidayPay: number;
  total: number;
};

export type SeveranceResult = {
  /** True when the contract started before 1 Oct 2013, the segmented
   *  transitional regime for that tenure isn't implemented, so every
   *  other field here is 0 and the caller MUST show the
   *  "not yet supported" message instead of any number. */
  preOct2013NotSupported: boolean;
  yearsOfService: number;
  cappedMonthlyBase: number;
  dayRatePerYear: number;
  rawAmount: number;
  totalCap: number;
  wasCapped: boolean;
  amount: number;
};

export type FixedTermCompensationResult = {
  preOct2013NotSupported: boolean;
  yearsOfService: number;
  dayRatePerYear: number;
  amount: number;
};

export type ResignationInput = {
  profile: TerminationProfile;
  contractType: "open_ended" | "fixed_term";
  /** Only meaningful when contractType is "fixed_term", the contract's
   *  own original agreed duration, which selects the 15- vs 30-day
   *  employee notice threshold (CT art. 400.º). */
  fixedTermOriginalDurationMonths?: number;
  /** How many days of notice the candidate plans to actually give. */
  noticeDaysPlanned: number;
};

export type ResignationResult = {
  noticeDaysRequired: number;
  noticeDaysPlanned: number;
  shortfallDays: number;
  dailyRemuneration: number;
  /** Automatic compensation owed to the employer for the notice
   *  shortfall (CT art. 401.º), no need for the employer to prove
   *  actual damages. */
  compensationOwed: number;
};

export type TaxExemptionResult = {
  /** avgMonthlyCompensation × yearsOfService, per CIRS art. 2.º, n.º 4,
   *  al. b): the per-situation exemption ceiling before the absolute cap. */
  exemptionCapFormula: number;
  /** 240 × RMMG, the absolute ceiling regardless of the formula above. */
  exemptionCapAbsolute: number;
  exemptAmount: number;
  taxableAmount: number;
};

export type MutualAgreementInput = {
  profile: TerminationProfile;
  /** The amount actually offered in the negotiated agreement. */
  offeredAmount: number;
};

export type MutualAgreementResult = {
  preOct2013NotSupported: boolean;
  /** What CT art. 366.º would pay for an equivalent dismissal without
   *  cause, the one real, sourced comparison point. There is NO legal
   *  minimum for a mútuo acordo itself (CT art. 349.º/350.º: purely
   *  negotiated); this is a benchmark, never an entitlement. */
  benchmarkSeverance: SeveranceResult;
  offeredAmount: number;
  /** Null when the benchmark is 0 or unsupported (pre-2013). */
  offeredAsPercentOfBenchmark: number | null;
  taxExemption: TaxExemptionResult;
};
