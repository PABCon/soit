import { useFormatter, useTranslations } from "next-intl";

export type SalaryPeriod = "hour" | "day" | "month" | "year";
export type EmploymentType =
  | "permanent"
  | "fixed_term"
  | "contractor"
  | "freelance"
  | "internship";
/** Real-usage finding: a source posting quoted a gross B2B rate alongside a
 *  net permanent-contract salary for the same role — this product always
 *  rendered every amount as "gross" (§5.2's own original invariant, true
 *  by construction when every job had exactly one, employee-style salary).
 *  Now an explicit, employer-set field rather than something inferred —
 *  defaults to "gross" everywhere, preserving that invariant for every job
 *  that never sets it otherwise. */
export type SalaryBasis = "gross" | "net";

export type SalaryOption = {
  /** null when the employer has chosen to hide the salary publicly
   *  (§pricing, paid-tier-only) — renders a "not disclosed" fallback
   *  instead of the amount. Never null for a free-tier job. */
  min: number | null;
  max: number | null;
  period: SalaryPeriod;
  /** Only meaningful when period is "month". Portugal pays over 14 (§5.2). */
  months?: number;
  employmentType: EmploymentType;
  basis?: SalaryBasis;
};

export type SalaryProps = SalaryOption & {
  currency?: string;
  size?: "feed" | "detail";
  /** Real-usage finding: some jobs genuinely offer more than one contract
   *  type at a different rate each (e.g. a gross B2B day-rate alongside a
   *  net permanent salary) — when given, every range is shown at once,
   *  each under its own small type label — direct feedback rejected an
   *  earlier click-to-switch version ("should be visible, I don't want to
   *  click on things"). A job with two rates is unavoidably a little
   *  taller than one with a single rate; this keeps that difference as
   *  small and consistent as possible rather than trying to hide it. */
  alternates?: SalaryOption[];
};

const PERIOD_KEY = {
  hour: "perHour",
  day: "perDay",
  month: "perMonth",
  year: "perYear",
} as const;

/**
 * The single salary component (§11). The feed row, the job page and the map
 * popover all render through this, so a salary can never be shown ambiguously
 * in one place and correctly in another.
 *
 * Always renders amount + period + (× months) + gross + employment type:
 * "2000–3000" alone is ambiguous in Portugal, where salaries are quoted
 * monthly, gross, over 14 months (§5.2).
 */
export function Salary({
  min,
  max,
  currency = "EUR",
  period,
  months,
  employmentType,
  basis = "gross",
  size = "feed",
  alternates,
}: SalaryProps) {
  const t = useTranslations("salary");
  const format = useFormatter();

  const options: SalaryOption[] = [{ min, max, period, months, employmentType, basis }, ...(alternates ?? [])];

  const money = (value: number) =>
    format.number(value, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });

  function renderOption(opt: SalaryOption, showLabel: boolean) {
    if (opt.min == null || opt.max == null) {
      return (
        <p
          className={
            size === "detail"
              ? "font-display text-3xl font-bold text-muted tabular-nums"
              : "font-display text-base font-bold text-muted tabular-nums"
          }
        >
          {t("notDisclosed")}
        </p>
      );
    }

    const showMonths = opt.period === "month" && typeof opt.months === "number";
    const meta = [
      showMonths ? t("months", { count: opt.months as number }) : null,
      t((opt.basis ?? "gross") === "net" ? "net" : "gross"),
      !showLabel ? t(`employmentType.${opt.employmentType}`) : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <>
        {showLabel && (
          <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
            {t(`employmentType.${opt.employmentType}`)}
          </p>
        )}
        <p
          className={
            size === "detail"
              ? "font-display text-3xl font-bold text-pine tabular-nums"
              : "font-display text-base font-bold text-pine tabular-nums"
          }
        >
          {money(opt.min)}–{money(opt.max)}
        </p>
        <p className={size === "detail" ? "mt-1 text-sm text-muted" : "mt-0.5 text-xs text-muted"}>
          {t(PERIOD_KEY[opt.period])} · {meta}
        </p>
      </>
    );
  }

  if (options.length === 1) {
    return <div>{renderOption(options[0], false)}</div>;
  }

  return (
    <div>
      {options.map((opt, i) => (
        <div key={opt.employmentType} className={i > 0 ? "mt-2 border-t border-line pt-2" : ""}>
          {renderOption(opt, true)}
        </div>
      ))}
    </div>
  );
}
