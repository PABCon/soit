"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { calculateEmploymentNet } from "@/lib/salary-calculator/engine/mode-a";
import { calculateFreelanceNet } from "@/lib/salary-calculator/engine/freelance";
import { calculateCompanyNet } from "@/lib/salary-calculator/engine/company";
import type {
  Profile,
  EmploymentInput,
  FreelanceInput,
  CompanyInput,
  MaritalStatus,
  Region,
  IrsJovemBenefitYear,
  ActivityType,
  ClientLocation,
  VatRegime,
} from "@/lib/salary-calculator/engine/types";
import { getWithholdingRuleSet, getMeta } from "@/lib/salary-calculator/rules/loader";
import { encodeState, decodeState, type CalculatorMode } from "@/lib/salary-calculator/url-state";

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

const DEFAULT_EMPLOYMENT_INPUT: EmploymentInput = {
  grossMonthly: 1500,
  paymentsPerYear: 14,
  twelfths: "none",
  meal: { type: "card", dailyValue: 10.46, daysPerMonth: 22 },
  exemptAllowanceMonthly: 0,
  irsApplicableAllowanceMonthly: 0,
};

const DEFAULT_FREELANCE_INPUT: FreelanceInput = {
  billing: { mode: "monthly", amount: 2000 },
  activityType: "art151",
  clientLocation: "pt",
  monthsSinceStart: 24,
  alsoEmployed: false,
  declaredExpenses: 0,
  vatRegime: "normal",
  withholdingWaiver: false,
  baseAdjustmentPct: 0,
};

const DEFAULT_COMPANY_INPUT: CompanyInput = {
  revenue: { mode: "annual", amount: 80000 },
  clientLocation: "pt",
  gerenteGrossMonthly: 2000,
  gerentePaymentsPerYear: 14,
  operatingExpensesAnnual: 5000,
  accountantMonthly: 100,
  municipalSurchargeRate: 0.015,
  isSME: true,
  distributeAllProfit: true,
  gerenteExemptViaOtherActivity: false,
};

const REGIONS: Region[] = ["continente", "madeira", "acores"];
const MARITAL_STATUSES: MaritalStatus[] = ["single", "married_two_earners", "married_single_earner"];
const BENEFIT_YEARS: IrsJovemBenefitYear[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MODES: CalculatorMode[] = ["employment", "freelance", "company"];
const ACTIVITY_TYPES: ActivityType[] = ["art151", "other_services"];
const CLIENT_LOCATIONS: ClientLocation[] = ["pt", "eu", "non_eu"];
const VAT_REGIMES: VatRegime[] = ["normal", "art53_exempt"];
const BASE_ADJUSTMENT_OPTIONS = [-0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25];

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
  const [mode, setMode] = useState<CalculatorMode>(sharedState?.mode ?? "employment");
  const [profile, setProfile] = useState<Profile>(sharedState?.profile ?? DEFAULT_PROFILE);
  const [employmentInput, setEmploymentInput] = useState<EmploymentInput>(
    sharedState?.employmentInput ?? DEFAULT_EMPLOYMENT_INPUT,
  );
  const [freelanceInput, setFreelanceInput] = useState<FreelanceInput>(
    sharedState?.freelanceInput ?? DEFAULT_FREELANCE_INPUT,
  );
  const [companyInput, setCompanyInput] = useState<CompanyInput>(sharedState?.companyInput ?? DEFAULT_COMPANY_INPUT);
  const [copied, setCopied] = useState(false);

  const employmentResult = useMemo(() => {
    try {
      return calculateEmploymentNet(profile, employmentInput);
    } catch {
      return null;
    }
  }, [profile, employmentInput]);

  const freelanceResult = useMemo(() => {
    try {
      return calculateFreelanceNet(profile, freelanceInput);
    } catch {
      return null;
    }
  }, [profile, freelanceInput]);

  const companyResult = useMemo(() => {
    try {
      return calculateCompanyNet(profile, companyInput);
    } catch {
      return null;
    }
  }, [profile, companyInput]);

  const meta = useMemo(() => getMeta(profile.year), [profile.year]);

  const withholdingTable = useMemo(() => {
    if (!employmentResult || employmentResult.monthly.irsTableUsed.startsWith("IFICI")) return null;
    try {
      return (
        getWithholdingRuleSet(profile.region, profile.year, profile.month).tables[employmentResult.monthly.irsTableUsed] ??
        null
      );
    } catch {
      return null;
    }
  }, [employmentResult, profile.region, profile.year, profile.month]);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  }

  function pct(value: number) {
    return format.number(value, { style: "percent", maximumFractionDigits: 1 });
  }

  async function handleShare() {
    const encoded = encodeState({ mode, profile, employmentInput, freelanceInput, companyInput });
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
      <div className="flex flex-wrap gap-2" role="tablist">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`h-9 rounded-lg px-4 text-sm font-medium transition-colors ${
              mode === m ? "bg-pine text-white" : "border border-line bg-white text-muted hover:text-pine"
            }`}
          >
            {t(`modeTab.${m}`)}
          </button>
        ))}
      </div>

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

          {mode === "employment" && (
            <fieldset className="space-y-4 rounded-xl border border-line bg-white p-4">
              <legend className="px-1 text-sm font-semibold">{t("contractHeading")}</legend>

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label={t("grossMonthly")}
                  step={10}
                  value={employmentInput.grossMonthly}
                  onChange={(v) => setEmploymentInput((i) => ({ ...i, grossMonthly: v }))}
                />
                <label className={labelClass}>
                  <span>{t("paymentsPerYear")}</span>
                  <select
                    value={employmentInput.paymentsPerYear}
                    onChange={(e) =>
                      setEmploymentInput((i) => ({ ...i, paymentsPerYear: Number(e.target.value) as 12 | 14 }))
                    }
                    className={inputClass}
                  >
                    <option value={14}>{t("paymentsPerYearOption14")}</option>
                    <option value={12}>{t("paymentsPerYearOption12")}</option>
                  </select>
                </label>
              </div>
              <p className="text-xs text-muted">{t("paymentsPerYearHint")}</p>

              {employmentInput.paymentsPerYear === 14 && (
                <label className={labelClass}>
                  <span>{t("twelfths")}</span>
                  <select
                    value={employmentInput.twelfths}
                    onChange={(e) =>
                      setEmploymentInput((i) => ({ ...i, twelfths: e.target.value as EmploymentInput["twelfths"] }))
                    }
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
                    value={employmentInput.meal.type}
                    onChange={(e) =>
                      setEmploymentInput((i) => ({
                        ...i,
                        meal: { ...i.meal, type: e.target.value as EmploymentInput["meal"]["type"] },
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="none">{t("mealTypeOptionNone")}</option>
                    <option value="cash">{t("mealTypeOptionCash")}</option>
                    <option value="card">{t("mealTypeOptionCard")}</option>
                  </select>
                </label>
                {employmentInput.meal.type !== "none" && (
                  <>
                    <NumberField
                      label={t("mealDailyValue")}
                      step={0.01}
                      value={employmentInput.meal.dailyValue}
                      onChange={(v) => setEmploymentInput((i) => ({ ...i, meal: { ...i.meal, dailyValue: v } }))}
                    />
                    <NumberField
                      label={t("mealDaysPerMonth")}
                      max={31}
                      value={employmentInput.meal.daysPerMonth}
                      onChange={(v) => setEmploymentInput((i) => ({ ...i, meal: { ...i.meal, daysPerMonth: v } }))}
                    />
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
                <NumberField
                  label={t("exemptAmount")}
                  hint={t("exemptAmountHint")}
                  value={employmentInput.exemptAllowanceMonthly ?? 0}
                  onChange={(v) => setEmploymentInput((i) => ({ ...i, exemptAllowanceMonthly: v }))}
                />
                <NumberField
                  label={t("irsApplicableAmount")}
                  hint={t("irsApplicableAmountHint")}
                  value={employmentInput.irsApplicableAllowanceMonthly ?? 0}
                  onChange={(v) => setEmploymentInput((i) => ({ ...i, irsApplicableAllowanceMonthly: v }))}
                />
              </div>
            </fieldset>
          )}

          {mode === "freelance" && (
            <fieldset className="space-y-4 rounded-xl border border-line bg-white p-4">
              <legend className="px-1 text-sm font-semibold">{t("freelanceHeading")}</legend>

              <div className="grid grid-cols-2 gap-4">
                <label className={labelClass}>
                  <span>{t("freelanceBillingMode")}</span>
                  <select
                    value={freelanceInput.billing.mode}
                    onChange={(e) =>
                      setFreelanceInput((i) => ({
                        ...i,
                        billing: { ...i.billing, mode: e.target.value as FreelanceInput["billing"]["mode"] },
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="monthly">{t("billingModeOption.monthly")}</option>
                    <option value="annual">{t("billingModeOption.annual")}</option>
                    <option value="dayRate">{t("billingModeOption.dayRate")}</option>
                  </select>
                </label>
                <NumberField
                  label={t(`freelanceBillingAmount.${freelanceInput.billing.mode}`)}
                  step={10}
                  value={freelanceInput.billing.amount}
                  onChange={(v) => setFreelanceInput((i) => ({ ...i, billing: { ...i.billing, amount: v } }))}
                />
              </div>

              {freelanceInput.billing.mode === "dayRate" && (
                <NumberField
                  label={t("freelanceDaysPerYear")}
                  hint={t("freelanceDaysPerYearHint")}
                  value={freelanceInput.billing.daysPerYear ?? 220}
                  onChange={(v) => setFreelanceInput((i) => ({ ...i, billing: { ...i.billing, daysPerYear: v } }))}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <label className={labelClass}>
                  <span>{t("freelanceActivityType")}</span>
                  <select
                    value={freelanceInput.activityType}
                    onChange={(e) =>
                      setFreelanceInput((i) => ({ ...i, activityType: e.target.value as ActivityType }))
                    }
                    className={inputClass}
                  >
                    {ACTIVITY_TYPES.map((a) => (
                      <option key={a} value={a}>
                        {t(`activityTypeOption.${a}`)}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted">{t("freelanceActivityTypeHint")}</span>
                </label>
                <label className={labelClass}>
                  <span>{t("freelanceClientLocation")}</span>
                  <select
                    value={freelanceInput.clientLocation}
                    onChange={(e) =>
                      setFreelanceInput((i) => ({ ...i, clientLocation: e.target.value as ClientLocation }))
                    }
                    className={inputClass}
                  >
                    {CLIENT_LOCATIONS.map((c) => (
                      <option key={c} value={c}>
                        {t(`clientLocationOption.${c}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <NumberField
                label={t("freelanceMonthsSinceStart")}
                hint={t("freelanceMonthsSinceStartHint")}
                value={freelanceInput.monthsSinceStart}
                onChange={(v) => setFreelanceInput((i) => ({ ...i, monthsSinceStart: v }))}
              />

              <details className="group rounded-lg border border-line">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted marker:content-none group-open:text-pine">
                  {t("freelanceAdvancedToggle")}
                </summary>
                <div className="space-y-4 border-t border-line p-3">
                  <div>
                    <label className={checkboxLabelClass}>
                      <input
                        type="checkbox"
                        checked={freelanceInput.alsoEmployed}
                        onChange={(e) => setFreelanceInput((i) => ({ ...i, alsoEmployed: e.target.checked }))}
                      />
                      {t("freelanceAlsoEmployed")}
                    </label>
                    <p className="mt-1 text-xs text-muted">{t("freelanceAlsoEmployedHint")}</p>
                  </div>

                  <NumberField
                    label={t("freelanceDeclaredExpenses")}
                    hint={t("freelanceDeclaredExpensesHint")}
                    value={freelanceInput.declaredExpenses}
                    onChange={(v) => setFreelanceInput((i) => ({ ...i, declaredExpenses: v }))}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <label className={labelClass}>
                      <span>{t("freelanceVatRegime")}</span>
                      <select
                        value={freelanceInput.vatRegime}
                        onChange={(e) => setFreelanceInput((i) => ({ ...i, vatRegime: e.target.value as VatRegime }))}
                        className={inputClass}
                      >
                        {VAT_REGIMES.map((v) => (
                          <option key={v} value={v}>
                            {t(`vatRegimeOption.${v}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      <span>{t("freelanceBaseAdjustment")}</span>
                      <select
                        value={freelanceInput.baseAdjustmentPct ?? 0}
                        onChange={(e) =>
                          setFreelanceInput((i) => ({ ...i, baseAdjustmentPct: Number(e.target.value) }))
                        }
                        className={inputClass}
                      >
                        {BASE_ADJUSTMENT_OPTIONS.map((pctOption) => (
                          <option key={pctOption} value={pctOption}>
                            {pct(pctOption)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className={checkboxLabelClass}>
                    <input
                      type="checkbox"
                      checked={freelanceInput.withholdingWaiver}
                      onChange={(e) => setFreelanceInput((i) => ({ ...i, withholdingWaiver: e.target.checked }))}
                    />
                    {t("freelanceWithholdingWaiver")}
                  </label>
                  <p className="text-xs text-muted">{t("freelanceWithholdingWaiverHint")}</p>
                </div>
              </details>
            </fieldset>
          )}

          {mode === "freelance" && (
            <div className="rounded-xl border border-line bg-paper p-4 text-sm">
              <h2 className="font-semibold">{t("freelanceGlossaryHeading")}</h2>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="font-medium">{t("freelanceGlossarySsTerm")}</dt>
                  <dd className="text-muted">{t("freelanceGlossarySsDefinition")}</dd>
                </div>
                <div>
                  <dt className="font-medium">{t("freelanceGlossaryCatBTerm")}</dt>
                  <dd className="text-muted">{t("freelanceGlossaryCatBDefinition")}</dd>
                </div>
                <div>
                  <dt className="font-medium">{t("freelanceGlossaryVatTerm")}</dt>
                  <dd className="text-muted">{t("freelanceGlossaryVatDefinition")}</dd>
                </div>
                <div>
                  <dt className="font-medium">{t("freelanceGlossaryWithholdingTerm")}</dt>
                  <dd className="text-muted">{t("freelanceGlossaryWithholdingDefinition")}</dd>
                </div>
              </dl>
            </div>
          )}

          {mode === "company" && (
            <fieldset className="space-y-4 rounded-xl border border-line bg-white p-4">
              <legend className="px-1 text-sm font-semibold">{t("companyHeading")}</legend>

              <div className="grid grid-cols-2 gap-4">
                <label className={labelClass}>
                  <span>{t("freelanceBillingMode")}</span>
                  <select
                    value={companyInput.revenue.mode}
                    onChange={(e) =>
                      setCompanyInput((i) => ({
                        ...i,
                        revenue: { ...i.revenue, mode: e.target.value as CompanyInput["revenue"]["mode"] },
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="monthly">{t("billingModeOption.monthly")}</option>
                    <option value="annual">{t("billingModeOption.annual")}</option>
                    <option value="dayRate">{t("billingModeOption.dayRate")}</option>
                  </select>
                </label>
                <NumberField
                  label={t(`companyRevenueAmount.${companyInput.revenue.mode}`)}
                  step={100}
                  value={companyInput.revenue.amount}
                  onChange={(v) => setCompanyInput((i) => ({ ...i, revenue: { ...i.revenue, amount: v } }))}
                />
              </div>

              {companyInput.revenue.mode === "dayRate" && (
                <NumberField
                  label={t("freelanceDaysPerYear")}
                  hint={t("freelanceDaysPerYearHint")}
                  value={companyInput.revenue.daysPerYear ?? 220}
                  onChange={(v) => setCompanyInput((i) => ({ ...i, revenue: { ...i.revenue, daysPerYear: v } }))}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label={t("companyGerenteGrossMonthly")}
                  step={10}
                  value={companyInput.gerenteGrossMonthly}
                  onChange={(v) => setCompanyInput((i) => ({ ...i, gerenteGrossMonthly: v }))}
                />
                <label className={labelClass}>
                  <span>{t("companyGerentePaymentsPerYear")}</span>
                  <select
                    value={companyInput.gerentePaymentsPerYear}
                    onChange={(e) =>
                      setCompanyInput((i) => ({ ...i, gerentePaymentsPerYear: Number(e.target.value) as 12 | 14 }))
                    }
                    className={inputClass}
                  >
                    <option value={14}>{t("paymentsPerYearOption14")}</option>
                    <option value={12}>{t("paymentsPerYearOption12")}</option>
                  </select>
                </label>
              </div>

              {companyInput.gerenteGrossMonthly === 0 && (
                <div>
                  <label className={checkboxLabelClass}>
                    <input
                      type="checkbox"
                      checked={companyInput.gerenteExemptViaOtherActivity ?? false}
                      onChange={(e) =>
                        setCompanyInput((i) => ({ ...i, gerenteExemptViaOtherActivity: e.target.checked }))
                      }
                    />
                    {t("companyGerenteExemptViaOtherActivity")}
                  </label>
                  <p className="mt-1 text-xs text-muted">{t("companyGerenteExemptViaOtherActivityHint")}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label={t("companyOperatingExpensesAnnual")}
                  step={100}
                  value={companyInput.operatingExpensesAnnual}
                  onChange={(v) => setCompanyInput((i) => ({ ...i, operatingExpensesAnnual: v }))}
                />
                <NumberField
                  label={t("companyAccountantMonthly")}
                  value={companyInput.accountantMonthly}
                  onChange={(v) => setCompanyInput((i) => ({ ...i, accountantMonthly: v }))}
                />
              </div>

              <NumberField
                label={t("companyMunicipalSurchargeRate")}
                hint={t("companyMunicipalSurchargeRateHint")}
                max={1.5}
                step={0.1}
                value={Math.round(companyInput.municipalSurchargeRate * 1000) / 10}
                onChange={(v) => setCompanyInput((i) => ({ ...i, municipalSurchargeRate: v / 100 }))}
              />

              <label className={checkboxLabelClass}>
                <input
                  type="checkbox"
                  checked={companyInput.isSME}
                  onChange={(e) => setCompanyInput((i) => ({ ...i, isSME: e.target.checked }))}
                />
                {t("companyIsSme")}
              </label>

              <label className={checkboxLabelClass}>
                <input
                  type="checkbox"
                  checked={companyInput.distributeAllProfit}
                  onChange={(e) => setCompanyInput((i) => ({ ...i, distributeAllProfit: e.target.checked }))}
                />
                {t("companyDistributeAllProfit")}
              </label>
              <p className="text-xs text-muted">{t("companyLegalReserveNote")}</p>
            </fieldset>
          )}
        </div>

        <div className="space-y-4">
          <div className="sticky top-4 rounded-xl border-2 border-pine/30 bg-white p-5">
            {mode === "employment" && (
              <>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("monthlyNetHeading")}</p>
                {employmentResult ? (
                  <>
                    <p className="font-display mt-1 text-4xl font-bold text-pine">
                      {money(employmentResult.monthly.netIncludingMeal)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {t("monthlyNetExcludingMeal", { amount: money(employmentResult.monthly.net) })}
                    </p>

                    <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("resultGross")}</dt>
                        <dd>{money(employmentResult.monthly.gross)}</dd>
                      </div>
                      {employmentResult.monthly.duodecimoGross > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-muted">{t("resultDuodecimo")}</dt>
                          <dd>+{money(employmentResult.monthly.duodecimoGross)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("resultSs")}</dt>
                        <dd>-{money(employmentResult.monthly.ss)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("resultIrs")}</dt>
                        <dd>-{money(employmentResult.monthly.irs)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("resultIrsRate")}</dt>
                        <dd>{pct(employmentResult.monthly.irsRate)}</dd>
                      </div>
                      {employmentResult.monthly.exemptMeal + employmentResult.monthly.taxableMeal > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-muted">{t("resultMeal")}</dt>
                          <dd>+{money(employmentResult.monthly.exemptMeal + employmentResult.monthly.taxableMeal)}</dd>
                        </div>
                      )}
                      {employmentResult.monthly.exemptAllowance > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-muted">{t("resultExemptAllowance")}</dt>
                          <dd>+{money(employmentResult.monthly.exemptAllowance)}</dd>
                        </div>
                      )}
                      {employmentResult.monthly.irsApplicableAllowance > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-muted">{t("resultIrsApplicableAllowance")}</dt>
                          <dd>+{money(employmentResult.monthly.irsApplicableAllowance)}</dd>
                        </div>
                      )}
                    </dl>

                    {employmentResult.subsidyMonths && (
                      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted">{t("resultHolidaySubsidy")}</dt>
                          <dd>{money(employmentResult.subsidyMonths.holiday.net)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted">{t("resultChristmasSubsidy")}</dt>
                          <dd>{money(employmentResult.subsidyMonths.christmas.net)}</dd>
                        </div>
                      </dl>
                    )}

                    <div className="mt-4 border-t border-line pt-4 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("resultAnnualNet")}</dt>
                        <dd className="font-semibold">{money(employmentResult.annual.netIncludingMeal)}</dd>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <dt className="text-muted">{t("resultEmployerCost")}</dt>
                        <dd>{money(employmentResult.employerCost.monthlyEquivalent)}</dd>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <dt className="text-muted">{t("resultEmployerCostAnnual")}</dt>
                        <dd>{money(employmentResult.employerCost.annual)}</dd>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">{t("resultError")}</p>
                )}
              </>
            )}

            {mode === "freelance" && (
              <>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("freelanceNetHeading")}</p>
                {freelanceResult ? (
                  <>
                    <p className="font-display mt-1 text-4xl font-bold text-pine">
                      {money(freelanceResult.monthly.trueNet)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {t("freelanceCashInHand", { amount: money(freelanceResult.monthly.cashInHand) })}
                    </p>

                    <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("freelanceResultInvoiced")}</dt>
                        <dd>{money(freelanceResult.monthly.invoiced)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("freelanceResultSs")}</dt>
                        <dd>-{money(freelanceResult.monthly.ss)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("freelanceResultIrsWithheld")}</dt>
                        <dd>-{money(freelanceResult.monthly.irsWithheld)}</dd>
                      </div>
                      {freelanceResult.monthly.vatOnInvoice > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-muted">{t("freelanceResultVat")}</dt>
                          <dd>{money(freelanceResult.monthly.vatOnInvoice)}</dd>
                        </div>
                      )}
                    </dl>

                    <div className="mt-4 rounded-lg bg-paper p-3">
                      <p className="text-xs font-semibold text-pine">{t("freelanceReserveHeading")}</p>
                      <p className="mt-1 text-lg font-semibold">{money(freelanceResult.recommendedMonthlyTaxReserve)}</p>
                      <p className="mt-1 text-xs text-muted">{t("freelanceReserveHint")}</p>
                    </div>

                    {freelanceResult.flags.length > 0 && (
                      <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-xs text-muted">
                        {freelanceResult.flags.map((flag) => (
                          <li key={flag}>• {t(`flagNote.${flag}`)}</li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-4 border-t border-line pt-4 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("freelanceResultAnnualTrueNet")}</dt>
                        <dd className="font-semibold">{money(freelanceResult.annual.trueNet)}</dd>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <dt className="text-muted">{t("freelanceResultAnnualInvoiced")}</dt>
                        <dd>{money(freelanceResult.annual.invoiced)}</dd>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">{t("resultError")}</p>
                )}
              </>
            )}

            {mode === "company" && (
              <>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("companyNetHeading")}</p>
                {companyResult ? (
                  <>
                    <p className="font-display mt-1 text-4xl font-bold text-pine">
                      {money(companyResult.person.takeHomeMonthlyEquivalent)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {t("companyTakeHomeAnnual", { amount: money(companyResult.person.takeHomeAnnual) })}
                    </p>

                    <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("companyResultGerenteSalary")}</dt>
                        <dd>{money(companyResult.person.gerenteNetSalary)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("companyResultDividendsGross")}</dt>
                        <dd>{money(companyResult.person.dividendsGross)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("companyResultDividendTax")}</dt>
                        <dd>-{money(companyResult.person.dividendTax)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("companyResultDividendsNet")}</dt>
                        <dd>{money(companyResult.person.dividendsNet)}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 border-t border-line pt-4 text-sm">
                      <p className="text-xs font-semibold text-muted uppercase">{t("companyPnlHeading")}</p>
                      <div className="mt-2 flex justify-between">
                        <dt className="text-muted">{t("companyResultRevenue")}</dt>
                        <dd>{money(companyResult.company.revenue)}</dd>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <dt className="text-muted">{t("companyResultExpenses")}</dt>
                        <dd>-{money(companyResult.company.expenses)}</dd>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <dt className="text-muted">{t("companyResultGerenteCost")}</dt>
                        <dd>-{money(companyResult.company.gerenteCost)}</dd>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <dt className="text-muted">{t("companyResultIrc")}</dt>
                        <dd>-{money(companyResult.company.irc)}</dd>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <dt className="text-muted">{t("companyResultDerrama")}</dt>
                        <dd>-{money(companyResult.company.derrama)}</dd>
                      </div>
                      <div className="mt-1 flex justify-between font-semibold">
                        <dt>{t("companyResultNetProfit")}</dt>
                        <dd>{money(companyResult.company.netProfit)}</dd>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-line pt-4 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">{t("companyResultEffectiveTaxRate")}</dt>
                        <dd>{pct(companyResult.effectiveTaxRate)}</dd>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">{t("resultError")}</p>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="mt-4 h-9 w-full rounded-lg border border-line text-sm font-medium text-pine hover:bg-paper"
            >
              {copied ? t("shareCopied") : t("shareButton")}
            </button>
          </div>

          <p className="text-xs text-muted">{t("disclaimer")}</p>
        </div>
      </div>

      {mode === "employment" && employmentResult && (
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-sm font-semibold">{t("breakdownHeading")}</h2>

          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between">
              <dt className="text-muted">{t("breakdownIrsBase")}</dt>
              <dd>{money(employmentResult.monthly.irsBase)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t("breakdownSsBase")}</dt>
              <dd>{money(employmentResult.monthly.ssBase)}</dd>
            </div>
            {withholdingTable && (
              <div className="flex justify-between">
                <dt className="text-muted">{t("breakdownTableUsed")}</dt>
                <dd className="text-right">{withholdingTable.label}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">{t("breakdownMarginalRate")}</dt>
              <dd>{pct(employmentResult.monthly.irsRate)}</dd>
            </div>
            {withholdingTable && (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted">{t("breakdownParcela")}</dt>
                  <dd>{money(employmentResult.monthly.irsParcela)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t("breakdownDependentDeduction")}</dt>
                  <dd>{money(employmentResult.monthly.irsDependentDeduction)}</dd>
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

          {!withholdingTable && <p className="mt-4 text-xs text-muted">{t("breakdownFlatRateNote")}</p>}

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
                      const isCurrent = bracket.rate === employmentResult.monthly.irsRate;
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
