"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { calculateEmploymentNet } from "@/lib/salary-calculator/engine/mode-a";
import type { Profile, EmploymentInput, MaritalStatus, Region, IrsJovemBenefitYear } from "@/lib/salary-calculator/engine/types";
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
  expenseAllowanceMonthly: 0,
  fringeBenefitsMonthly: 0,
};

const REGIONS: Region[] = ["continente", "madeira", "acores"];
const MARITAL_STATUSES: MaritalStatus[] = ["single", "married_two_earners", "married_single_earner"];
const BENEFIT_YEARS: IrsJovemBenefitYear[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
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

          <div className="grid grid-cols-3 gap-4">
            <label className={labelClass}>
              <span>{t("dependents")}</span>
              <input
                type="number"
                min={0}
                value={profile.dependents}
                onChange={(e) => setProfile((p) => ({ ...p, dependents: Math.max(0, Number(e.target.value)) }))}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span>{t("dependentsUnder3")}</span>
              <input
                type="number"
                min={0}
                value={profile.dependentsUnder3}
                onChange={(e) => setProfile((p) => ({ ...p, dependentsUnder3: Math.max(0, Number(e.target.value)) }))}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span>{t("dependentsWithDisability")}</span>
              <input
                type="number"
                min={0}
                value={profile.dependentsWithDisability}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, dependentsWithDisability: Math.max(0, Number(e.target.value)) }))
                }
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              <span>{t("age")}</span>
              <input
                type="number"
                min={16}
                max={100}
                value={profile.age}
                onChange={(e) => setProfile((p) => ({ ...p, age: Number(e.target.value) }))}
                className={inputClass}
              />
            </label>
            <label className={checkboxLabelClass} style={{ alignSelf: "end", paddingBottom: "0.5rem" }}>
              <input
                type="checkbox"
                checked={profile.disabilityAbove60}
                onChange={(e) => setProfile((p) => ({ ...p, disabilityAbove60: e.target.checked }))}
              />
              {t("disabilityAbove60")}
            </label>
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
            <label className={labelClass}>
              <span>{t("grossMonthly")}</span>
              <input
                type="number"
                min={0}
                step={10}
                value={input.grossMonthly}
                onChange={(e) => setInput((i) => ({ ...i, grossMonthly: Math.max(0, Number(e.target.value)) }))}
                className={inputClass}
              />
            </label>
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
                <label className={labelClass}>
                  <span>{t("mealDailyValue")}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={input.meal.dailyValue}
                    onChange={(e) =>
                      setInput((i) => ({ ...i, meal: { ...i.meal, dailyValue: Math.max(0, Number(e.target.value)) } }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("mealDaysPerMonth")}</span>
                  <input
                    type="number"
                    min={0}
                    max={31}
                    value={input.meal.daysPerMonth}
                    onChange={(e) =>
                      setInput((i) => ({ ...i, meal: { ...i.meal, daysPerMonth: Math.max(0, Number(e.target.value)) } }))
                    }
                    className={inputClass}
                  />
                </label>
              </>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-line bg-white p-4">
          <legend className="px-1 text-sm font-semibold">{t("extraBenefitsHeading")}</legend>

          <label className={labelClass}>
            <span>{t("expenseAllowance")}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={input.expenseAllowanceMonthly ?? 0}
              onChange={(e) =>
                setInput((i) => ({ ...i, expenseAllowanceMonthly: Math.max(0, Number(e.target.value)) }))
              }
              className={inputClass}
            />
            <span className="text-xs text-muted">{t("expenseAllowanceHint")}</span>
          </label>

          <label className={labelClass}>
            <span>{t("fringeBenefits")}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={input.fringeBenefitsMonthly ?? 0}
              onChange={(e) =>
                setInput((i) => ({ ...i, fringeBenefitsMonthly: Math.max(0, Number(e.target.value)) }))
              }
              className={inputClass}
            />
            <span className="text-xs text-muted">{t("fringeBenefitsHint")}</span>
          </label>
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
                {result.monthly.exemptMeal + result.monthly.taxableMeal > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("resultMeal")}</dt>
                    <dd>+{money(result.monthly.exemptMeal + result.monthly.taxableMeal)}</dd>
                  </div>
                )}
                {result.monthly.expenseAllowance > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("resultExpenseAllowance")}</dt>
                    <dd>+{money(result.monthly.expenseAllowance)}</dd>
                  </div>
                )}
                {result.monthly.fringeBenefits > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("resultFringeBenefits")}</dt>
                    <dd>+{money(result.monthly.fringeBenefits)}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-4 border-t border-line pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">{t("resultAnnualNet")}</dt>
                  <dd className="font-semibold">{money(result.annual.netIncludingMeal)}</dd>
                </div>
                <div className="mt-1 flex justify-between">
                  <dt className="text-muted">{t("resultEmployerCost")}</dt>
                  <dd>{money(result.employerCost.monthlyEquivalent)}</dd>
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
  );
}
