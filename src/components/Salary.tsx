import { useFormatter, useTranslations } from "next-intl";

export type SalaryPeriod = "hour" | "day" | "month" | "year";
export type EmploymentType =
  | "permanent"
  | "fixed_term"
  | "contractor"
  | "freelance"
  | "internship";

export type SalaryProps = {
  min: number;
  max: number;
  currency?: string;
  period: SalaryPeriod;
  /** Only meaningful when period is "month". Portugal pays over 14 (§5.2). */
  months?: number;
  employmentType: EmploymentType;
  size?: "feed" | "detail";
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
  size = "feed",
}: SalaryProps) {
  const t = useTranslations("salary");
  const format = useFormatter();

  const money = (value: number) =>
    format.number(value, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });

  const showMonths = period === "month" && typeof months === "number";

  const meta = [
    showMonths ? t("months", { count: months as number }) : null,
    t("gross"),
    t(`employmentType.${employmentType}`),
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
        {money(min)}–{money(max)}
      </p>
      <p
        className={
          size === "detail"
            ? "mt-1 text-sm text-muted"
            : "mt-0.5 text-xs text-muted"
        }
      >
        {t(PERIOD_KEY[period])} · {meta}
      </p>
    </div>
  );
}
