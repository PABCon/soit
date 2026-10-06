"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { calculateEmploymentNet } from "@/lib/salary-calculator/engine/mode-a";
import type { Profile, EmploymentInput, MaritalStatus, Region, IrsJovemBenefitYear } from "@/lib/salary-calculator/engine/types";
import { getWithholdingRuleSet, getMeta } from "@/lib/salary-calculator/rules/loader";
import { encodeState, decodeState } from "@/lib/salary-calculator/url-state";

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";
const checkboxLabelClass = "flex items-center gap-2 text-sm";

const DEFAULT_PROFILE: Profile = {
  year: 2026,
  month: 1,
  region: "continente",
  maritalStatus: "single",
  dependents: 0,
  dependentsUnder3: 0,
  dependentsWithDisability: 0,
  disabilityAbove60: false,
  spouseHasDisability: false,
  age: 30,
  irsJovem: { enabled: false, benefitYear: 1 },
  flatRate20: false,
};

const DEFAULT_INPUT: EmploymentInput = {
  grossMonthly: 1500,
  paymentsPerYear: 14,
  twelfths: "none",
  meal: { type: "card", dailyValue: 10.46, daysPerMonth: 22 },
  exemptAllowanceMonthly: 0,
  irsApplicableAllowanceMonthly: 0,
};

const REGIONS: Region[] = ["continente", "madeira", "acores"];
const MARITAL_STATUSES: MaritalStatus[] = ["single", "married_two_earners", "married_single_earner"];
const BENEFIT_YEARS: IrsJovemBenefitYear[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** A plain number input fights you the moment the field reads "0" and you
 *  try to type a new value — the browser inserts instead of replacing,
 *  leaving "01" or "011". Showing an empty string whenever the underlying
 *  value is 0 gives the field a genuinely blank starting point to type
 *  into, which is what every other numeric field in this form needs. */
function NumberField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className={labelClass}>
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value === 0 ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(0);
            return;
          }
          const parsed = Number(raw);
          if (Number.isNaN(parsed)) return;
          let next = Math.max(min, parsed);
          if (max !== undefined) next = Math.min(max, next);
          onChange(next);
        }}
        className={inputClass}
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SalaryCalculatorForm() {
  const t = useTranslations("salaryCalculator");
  const format = useFormatter();
  const searchParams = useSearchParams();
  const sharedState = useMemo(() => {
    const s = searchParams.get("s");
    return s ? decodeState(s) : null;
    // Only ever read once, on first render — a later edit to the form
    // must not get clobbered by re-reading the original shared link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [profile, setProfile] = useState<Profile>(sharedState?.profile ?? DEFAULT_PROFILE);
  const [input, setInput] = useState<EmploymentInput>(sharedState?.input ?? DEFAULT_INPUT);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    try {
      return calculateEmploymentNet(profile, input);
    } catch {
      return null;
    }
  }, [profile, input]);

  const meta = useMemo(() => getMeta(profile.year), [profile.year]);

  const withholdingTable = useMemo(() => {
    if (!result || result.monthly.irsTableUsed.startsWith("IFICI")) return null;
    try {
      return getWithholdingRuleSet(profile.region, profile.year, profile.month).tables[result.monthly.irsTableUsed] ?? null;
    } catch {
      return null;
    }
  }, [result, profile.region, profile.year, profile.month]);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  }

  function pct(value: number) {
    return format.number(value, { style: "percent", maximumFractionDigits: 1 });
  }

  async function handleShare() {
    const encoded = encodeState({ profile, input });
    const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard can be denied by the browser — not worth surfacing an error for.
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <fieldset className="space-y-4 rounded-xl border border-line bg-white p-4">
            <legend className="px-1 text-sm font-semibold">{t("aboutYouHeading")}</legend>

            <div className="grid grid-cols-2 gap-4">
              <label className={labelClass}>
                <span>{t("region")}</span>
                <select
                  value={profile.region}
                  onChange={(e) => setProfile((p) => ({ ...p, region: e.target.value as Region }))}
                  className={inputClass}
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`regionOption.${r}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                <span>{t("maritalStatus")}</span>
                <select
                  value={profile.maritalStatus}
                  onChange={(e) => setProfile((p) => ({ ...p, maritalStatus: e.target.value as MaritalStatus }))}
                  className={inputClass}
                >
                  {MARITAL_STATUSES.map((m) => (
                    <option key={m} value={m}>
                      {t(`maritalStatusOption.${m}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-muted">{t("maritalStatusHint")}</p>

            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label={t("dependents")}
                value={profile.dependents}
                onChange={(v) => setProfile((p) => ({ ...p, dependents: v }))}
              />
              <NumberField
                label={t("age")}
                min={16}
                max={100}
                value={profile.age}
                onChange={(v) => setProfile((p) => ({ ...p, age: v }))}
              />
            </div>

            <div>
              <label className={checkboxLabelClass}>
                <input
                  type="checkbox"
                  checked={profile.disabilityAbove60}
                  onChange={(e) => setProfile((p) => ({ ...p, disabilityAbove60: e.target.checked }))}
                />
                {t("disabilityAbove60")}
              </label>
              <p className="mt-1 text-xs text-muted">{t("disabilityAbove60Hint")}</p>
            </div>

            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                checked={profile.flatRate20}
                onChange={(e) => setProfile((p) => ({ ...p, flatRate20: e.target.checked }))}
              />
              {t("flatRate20")}
            </label>

            {profile.age <= 35 && (
              <div className="rounded-lg bg-paper p-3">
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    checked={profile.irsJovem.enabled}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, irsJovem: { ...p.irsJovem, enabled: e.target.checked } }))
                    }
                    disabled={profile.flatRate20}
                  />
                  {t("irsJovemEnabled")}
                </label>
                {profile.irsJovem.enabled && (
                  <label className={`${labelClass} mt-2`}>
                    <span>{t("irsJovemBenefitYear")}</span>
                    <select
                      value={profile.irsJovem.benefitYear}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          irsJovem: { ...p.irsJovem, benefitYear: Number(e.target.value) as IrsJovemBenefitYear },
                        }))
                      }
                      className={inputClass}
                    >
                      {BENEFIT_YEARS.map((y) => (
                        <option key={y} value={y}>
                          {t("irsJovemYearOption", { year: y })}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-4 rounded-xl border border-line bg-white p-4">
            <legend className="px-1 text-sm font-semibold">{t("contractHeading")}</legend>

            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label={t("grossMonthly")}
                step={10}
                value={input.grossMonthly}
                onChange={(v) => setInput((i) => ({ ...i, grossMonthly: v }))}
              />
              <label className={labelClass}>
                <span>{t("paymentsPerYear")}</span>
                <select
                  value={input.paymentsPerYear}
                  onChange={(e) => setInput((i) => ({ ...i, paymentsPerYear: Number(e.target.value) as 12 | 14 }))}
                  className={inputClass}
                >
                  <option value={14}>{t("paymentsPerYearOption14")}</option>
                  <option value={12}>{t("paymentsPerYearOption12")}</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-muted">{t("paymentsPerYearHint")}</p>

            {input.paymentsPerYear === 14 && (
              <label className={labelClass}>
                <span>{t("twelfths")}</span>
                <select
                  value={input.twelfths}
                  onChange={(e) => setInput((i) => ({ ...i, twelfths: e.target.value as EmploymentInput["twelfths"] }))}
                  className={inputClass}
                >
                  <option value="none">{t("twelfthsOptionNone")}</option>
                  <option value="half">{t("twelfthsOptionHalf")}</option>
                  <option value="full">{t("twelfthsOptionFull")}</option>
                </select>
              </label>
            )}

            <div className="grid grid-cols-3 gap-4">
              <label className={labelClass}>
                <span>{t("mealType")}</span>
                <select
                  value={input.meal.type}
                  onChange={(e) =>
                    setInput((i) => ({ ...i, meal: { ...i.meal, type: e.target.value as EmploymentInput["meal"]["type"] } }))
                  }
                  className={inputClass}
                >
                  <option value="none">{t("mealTypeOptionNone")}</option>
                  <option value="cash">{t("mealTypeOptionCash")}</option>
                  <option value="card">{t("mealTypeOptionCard")}</option>
                </select>
              </label>
              {input.meal.type !== "none" && (
                <>
                  <NumberField
                    label={t("mealDailyValue")}
                    step={0.01}
                    value={input.meal.dailyValue}
                    onChange={(v) => setInput((i) => ({ ...i, meal: { ...i.meal, dailyValue: v } }))}
                  />
                  <NumberField
                    label={t("mealDaysPerMonth")}
                    max={31}
                    value={input.meal.daysPerMonth}
                    onChange={(v) => setInput((i) => ({ ...i, meal: { ...i.meal, daysPerMonth: v } }))}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
              <NumberField
                label={t("exemptAmount")}
                hint={t("exemptAmountHint")}
                value={input.exemptAllowanceMonthly ?? 0}
                onChange={(v) => setInput((i) => ({ ...i, exemptAllowanceMonthly: v }))}
              />
              <NumberField
                label={t("irsApplicableAmount")}
                hint={t("irsApplicableAmountHint")}
                value={input.irsApplicableAllowanceMonthly ?? 0}
                onChange={(v) => setInput((i) => ({ ...i, irsApplicableAllowanceMonthly: v }))}
              />
            </div>
          </fieldset>
        </div>

        <div className="space-y-4">
          <div className="sticky top-4 rounded-xl border-2 border-pine/30 bg-white p-5">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("monthlyNetHeading")}</p>
            {result ? (
              <>
                <p className="font-display mt-1 text-4xl font-bold text-pine">{money(result.monthly.netIncludingMeal)}</p>
                <p className="mt-1 text-xs text-muted">
                  {t("monthlyNetExcludingMeal", { amount: money(result.monthly.net) })}
                </p>

                <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("resultGross")}</dt>
                    <dd>{money(result.monthly.gross)}</dd>
                  </div>
                  {result.monthly.duodecimoGross > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("resultDuodecimo")}</dt>
                      <dd>+{money(result.monthly.duodecimoGross)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("resultSs")}</dt>
                    <dd>-{money(result.monthly.ss)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("resultIrs")}</dt>
                    <dd>-{money(result.monthly.irs)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("resultIrsRate")}</dt>
                    <dd>{pct(result.monthly.irsRate)}</dd>
                  </div>
                  {result.monthly.exemptMeal + result.monthly.taxableMeal > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("resultMeal")}</dt>
                      <dd>+{money(result.monthly.exemptMeal + result.monthly.taxableMeal)}</dd>
                    </div>
                  )}
                  {result.monthly.exemptAllowance > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("resultExemptAllowance")}</dt>
                      <dd>+{money(result.monthly.exemptAllowance)}</dd>
                    </div>
                  )}
                  {result.monthly.irsApplicableAllowance > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("resultIrsApplicableAllowance")}</dt>
                      <dd>+{money(result.monthly.irsApplicableAllowance)}</dd>
                    </div>
                  )}
                </dl>

                {result.subsidyMonths && (
                  <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("resultHolidaySubsidy")}</dt>
                      <dd>{money(result.subsidyMonths.holiday.net)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("resultChristmasSubsidy")}</dt>
                      <dd>{money(result.subsidyMonths.christmas.net)}</dd>
                    </div>
                  </dl>
                )}

                <div className="mt-4 border-t border-line pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("resultAnnualNet")}</dt>
                    <dd className="font-semibold">{money(result.annual.netIncludingMeal)}</dd>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <dt className="text-muted">{t("resultEmployerCost")}</dt>
                    <dd>{money(result.employerCost.monthlyEquivalent)}</dd>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <dt className="text-muted">{t("resultEmployerCostAnnual")}</dt>
                    <dd>{money(result.employerCost.annual)}</dd>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleShare}
                  className="mt-4 h-9 w-full rounded-lg border border-line text-sm font-medium text-pine hover:bg-paper"
                >
                  {copied ? t("shareCopied") : t("shareButton")}
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("resultError")}</p>
            )}
          </div>

          <p className="text-xs text-muted">{t("disclaimer")}</p>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-sm font-semibold">{t("breakdownHeading")}</h2>

          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between">
              <dt className="text-muted">{t("breakdownIrsBase")}</dt>
              <dd>{money(result.monthly.irsBase)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t("breakdownSsBase")}</dt>
              <dd>{money(result.monthly.ssBase)}</dd>
            </div>
            {withholdingTable && (
              <div className="flex justify-between">
                <dt className="text-muted">{t("breakdownTableUsed")}</dt>
                <dd className="text-right">{withholdingTable.label}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">{t("breakdownMarginalRate")}</dt>
              <dd>{pct(result.monthly.irsRate)}</dd>
            </div>
            {withholdingTable && (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted">{t("breakdownParcela")}</dt>
                  <dd>{money(result.monthly.irsParcela)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t("breakdownDependentDeduction")}</dt>
                  <dd>{money(result.monthly.irsDependentDeduction)}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">{t("breakdownSsEmployeeRate")}</dt>
              <dd>{pct(meta.socialSecurity.employeeRate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t("breakdownSsEmployerRate")}</dt>
              <dd>{pct(meta.socialSecurity.employerRate)}</dd>
            </div>
          </dl>

          {!withholdingTable && (
            <p className="mt-4 text-xs text-muted">{t("breakdownFlatRateNote")}</p>
          )}

          {withholdingTable && (
            <>
              <p className="mt-5 text-xs font-medium text-muted">
                {t("breakdownBracketsIntro", { table: withholdingTable.label })}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="py-1 pr-4 font-medium">{t("breakdownColUpTo")}</th>
                      <th className="py-1 pr-4 font-medium">{t("breakdownColRate")}</th>
                      <th className="py-1 pr-4 font-medium">{t("breakdownColDeduction")}</th>
                      <th className="py-1 font-medium">{t("breakdownColPerDependent")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withholdingTable.brackets.map((bracket, idx) => {
                      const isCurrent = bracket.rate === result.monthly.irsRate;
                      return (
                        <tr
                          key={idx}
                          className={`border-t border-line ${isCurrent ? "bg-pine/5 font-semibold text-pine" : ""}`}
                        >
                          <td className="py-1.5 pr-4">
                            {bracket.upTo === null ? t("breakdownNoUpperLimit") : money(bracket.upTo)}
                          </td>
                          <td className="py-1.5 pr-4">{pct(bracket.rate)}</td>
                          <td className="py-1.5 pr-4">
                            {bracket.parcela.type === "fixed" ? money(bracket.parcela.value) : t("breakdownFormulaParcela")}
                          </td>
                          <td className="py-1.5">{money(bracket.perDependent)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
