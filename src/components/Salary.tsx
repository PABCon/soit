"use client";

import { useState } from "react";
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
   *  net permanent salary) — when given, the employment-type text becomes
   *  a small set of toggle labels switching the whole amount shown between
   *  this job's primary range (this component's own top-level props) and
   *  each of these. Same two-line footprint either way — a job with two
   *  rates never grows taller than one with a single rate, so a feed/list
   *  of cards stays evenly sized regardless of how many a given job has. */
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
  const [selected, setSelected] = useState(0);

  const options: SalaryOption[] = [{ min, max, period, months, employmentType, basis }, ...(alternates ?? [])];
  const active = options[selected] ?? options[0];

  const money = (value: number) =>
    format.number(value, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });

  if (active.min == null || active.max == null) {
    return (
      <div>
        <p
          className={
            size === "detail"
              ? "font-display text-3xl font-bold text-muted tabular-nums"
              : "font-display text-base font-bold text-muted tabular-nums"
          }
        >
          {t("notDisclosed")}
        </p>
      </div>
    );
  }

  const showMonths = active.period === "month" && typeof active.months === "number";

  const meta = [
    showMonths ? t("months", { count: active.months as number }) : null,
    t((active.basis ?? "gross") === "net" ? "net" : "gross"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <p
        className={
          size === "detail"
            ? "font-display text-3xl font-bold text-pine tabular-nums"
            : "font-display text-base font-bold text-pine tabular-nums"
        }
      >
        {money(active.min)}–{money(active.max)}
      </p>
      <p
        className={
          size === "detail"
            ? "mt-1 text-sm text-muted"
            : "mt-0.5 text-xs text-muted"
        }
      >
        {t(PERIOD_KEY[active.period])} · {meta} ·{" "}
        {options.length > 1 ? (
          options.map((opt, i) => (
            <span key={opt.employmentType}>
              {i > 0 && "/"}
              <button
                type="button"
                onClick={() => setSelected(i)}
                className={
                  i === selected
                    ? "font-semibold text-pine underline underline-offset-2"
                    : "text-muted underline-offset-2 hover:text-ink hover:underline"
                }
              >
                {t(`employmentType.${opt.employmentType}`)}
              </button>
            </span>
          ))
        ) : (
          <span>{t(`employmentType.${active.employmentType}`)}</span>
        )}
      </p>
    </div>
  );
}
