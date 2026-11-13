"use client";

import { useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { buttonClassName } from "@/components/Button";
import { calculateSeverance } from "@/lib/termination-calculator/engine/severance";
import { calculateFixedTermCompensation } from "@/lib/termination-calculator/engine/fixed-term";
import { calculateResignationNotice } from "@/lib/termination-calculator/engine/resignation";
import { calculateMutualAgreementComparison } from "@/lib/termination-calculator/engine/mutual-agreement";
import { calculateProportionalEntitlements } from "@/lib/termination-calculator/engine/proportionals";
import { encodeState, decodeState, type TerminationCalculatorMode } from "@/lib/termination-calculator/url-state";
import type { TerminationProfile } from "@/lib/termination-calculator/engine/types";

const MODES: TerminationCalculatorMode[] = ["dismissal", "fixed_term", "mutual_agreement", "resignation"];

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_PROFILE: TerminationProfile = {
  monthlyRemuneration: 1500,
  contractStartDate: "2022-01-01",
  cessationDate: todayIso(),
};

/** Same leading-zero input fix as salary-calculator/SalaryCalculatorForm's
 *  own `NumberField` (not extracted as a shared component there either),
 *  copied rather than imported across features. */
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

export function TerminationCalculatorForm() {
  const t = useTranslations("terminationCalculator");
  const format = useFormatter();
  const searchParams = useSearchParams();

  const sharedState = useMemo(() => {
    const s = searchParams.get("s");
    return s ? decodeState(s) : null;
    // Only ever read once, on first render, same reasoning as the salary
    // calculator's own identical pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const modeParam = searchParams.get("mode");

  const [mode, setMode] = useState<TerminationCalculatorMode>(
    sharedState?.mode ??
      (MODES.includes(modeParam as TerminationCalculatorMode) ? (modeParam as TerminationCalculatorMode) : "dismissal"),
  );
  const [profile, setProfile] = useState<TerminationProfile>(sharedState?.profile ?? DEFAULT_PROFILE);
  const [unusedPriorYearHolidayDays, setUnusedPriorYearHolidayDays] = useState(
    sharedState?.unusedPriorYearHolidayDays ?? 0,
  );
  const [mutualAgreementOfferedAmount, setMutualAgreementOfferedAmount] = useState(
    sharedState?.mutualAgreementOfferedAmount ?? 0,
  );
  const [resignationContractType, setResignationContractType] = useState<"open_ended" | "fixed_term">(
    sharedState?.resignationContractType ?? "open_ended",
  );
  const [resignationFixedTermOriginalDurationMonths, setResignationFixedTermOriginalDurationMonths] = useState(
    sharedState?.resignationFixedTermOriginalDurationMonths ?? 12,
  );
  const [resignationNoticeDaysPlanned, setResignationNoticeDaysPlanned] = useState(
    sharedState?.resignationNoticeDaysPlanned ?? 30,
  );
  const [copied, setCopied] = useState(false);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  }

  const severanceResult = useMemo(() => {
    try {
      return calculateSeverance(profile);
    } catch {
      return null;
    }
  }, [profile]);

  const fixedTermResult = useMemo(() => {
    try {
      return calculateFixedTermCompensation(profile);
    } catch {
      return null;
    }
  }, [profile]);

  const resignationResult = useMemo(() => {
    try {
      return calculateResignationNotice({
        profile,
        contractType: resignationContractType,
        fixedTermOriginalDurationMonths: resignationFixedTermOriginalDurationMonths,
        noticeDaysPlanned: resignationNoticeDaysPlanned,
      });
    } catch {
      return null;
    }
  }, [profile, resignationContractType, resignationFixedTermOriginalDurationMonths, resignationNoticeDaysPlanned]);

  const mutualAgreementResult = useMemo(() => {
    try {
      return calculateMutualAgreementComparison({ profile, offeredAmount: mutualAgreementOfferedAmount });
    } catch {
      return null;
    }
  }, [profile, mutualAgreementOfferedAmount]);

  const entitlements = useMemo(() => {
    try {
      return calculateProportionalEntitlements({ profile, unusedPriorYearHolidayDays });
    } catch {
      return null;
    }
  }, [profile, unusedPriorYearHolidayDays]);

  async function handleShare() {
    const encoded = encodeState({
      mode,
      profile,
      unusedPriorYearHolidayDays,
      mutualAgreementOfferedAmount,
      resignationContractType,
      resignationFixedTermOriginalDurationMonths,
      resignationNoticeDaysPlanned,
    });
    const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard can be denied by the browser, not worth surfacing an error for.
    }
  }

  const entitlementsSection = entitlements && (
    <div className="mt-4 border-t border-line pt-4 text-sm">
      <h3 className="font-semibold text-ink">{t("entitlementsHeading")}</h3>
      <p className="mt-0.5 text-xs text-muted">{t("entitlementsSubtitle")}</p>
      <dl className="mt-3 space-y-1.5">
        <div className="flex justify-between">
          <dt className="text-muted">{t("entitlementsHolidayLine", { days: entitlements.proportionalHolidayDays })}</dt>
          <dd className="font-medium text-ink">{money(entitlements.proportionalHolidayPay)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">{t("entitlementsChristmasLine")}</dt>
          <dd className="font-medium text-ink">{money(entitlements.proportionalChristmasSubsidy)}</dd>
        </div>
        {unusedPriorYearHolidayDays > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">{t("entitlementsUnusedLine")}</dt>
            <dd className="font-medium text-ink">{money(entitlements.unusedPriorYearHolidayPay)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
          <dt>{t("entitlementsTotalLine")}</dt>
          <dd>{money(entitlements.total)}</dd>
        </div>
      </dl>
    </div>
  );

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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <fieldset className="min-w-0 space-y-4 rounded-xl border border-line bg-white p-4">
            <legend className="px-1 text-sm font-semibold">{t("aboutYouHeading")}</legend>

            <NumberField
              label={t("monthlyRemuneration")}
              hint={t("monthlyRemunerationHint")}
              value={profile.monthlyRemuneration}
              onChange={(v) => setProfile((p) => ({ ...p, monthlyRemuneration: v }))}
              step={50}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                <span>{t("contractStartDate")}</span>
                <input
                  type="date"
                  value={profile.contractStartDate}
                  onChange={(e) => setProfile((p) => ({ ...p, contractStartDate: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                <span>{t("cessationDate")}</span>
                <input
                  type="date"
                  value={profile.cessationDate}
                  onChange={(e) => setProfile((p) => ({ ...p, cessationDate: e.target.value }))}
                  className={inputClass}
                />
              </label>
            </div>

            {mode === "mutual_agreement" && (
              <NumberField
                label={t("mutualAgreementOfferedAmount")}
                value={mutualAgreementOfferedAmount}
                onChange={setMutualAgreementOfferedAmount}
                step={100}
              />
            )}

            {mode === "resignation" && (
              <>
                <label className={labelClass}>
                  <span>{t("resignationContractType")}</span>
                  <select
                    value={resignationContractType}
                    onChange={(e) => setResignationContractType(e.target.value as "open_ended" | "fixed_term")}
                    className={inputClass}
                  >
                    <option value="open_ended">{t("resignationContractTypeOption.open_ended")}</option>
                    <option value="fixed_term">{t("resignationContractTypeOption.fixed_term")}</option>
                  </select>
                </label>
                {resignationContractType === "fixed_term" && (
                  <NumberField
                    label={t("resignationFixedTermOriginalDurationMonths")}
                    value={resignationFixedTermOriginalDurationMonths}
                    onChange={setResignationFixedTermOriginalDurationMonths}
                  />
                )}
                <NumberField
                  label={t("resignationNoticeDaysPlanned")}
                  value={resignationNoticeDaysPlanned}
                  onChange={setResignationNoticeDaysPlanned}
                />
              </>
            )}

            <NumberField
              label={t("unusedPriorYearHolidayDays")}
              value={unusedPriorYearHolidayDays}
              onChange={setUnusedPriorYearHolidayDays}
            />
          </fieldset>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-5">
            {mode === "dismissal" &&
              (severanceResult?.preOct2013NotSupported ? (
                <p className="text-sm text-muted">{t("preOct2013Message")}</p>
              ) : severanceResult ? (
                <>
                  <h2 className="font-display text-lg font-bold">{t("dismissalResultHeading")}</h2>
                  <p className="mt-3 font-display text-3xl font-bold text-pine">{money(severanceResult.amount)}</p>
                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("dismissalYearsOfService")}</dt>
                      <dd className="font-medium text-ink">{severanceResult.yearsOfService.toFixed(1)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted">{t("dismissalFormulaNote")}</p>
                  {severanceResult.wasCapped && <p className="mt-1 text-xs text-muted">{t("dismissalCappedNote")}</p>}
                  {entitlementsSection}
                </>
              ) : null)}

            {mode === "fixed_term" &&
              (fixedTermResult?.preOct2013NotSupported ? (
                <p className="text-sm text-muted">{t("preOct2013Message")}</p>
              ) : fixedTermResult ? (
                <>
                  <h2 className="font-display text-lg font-bold">{t("fixedTermResultHeading")}</h2>
                  <p className="mt-3 font-display text-3xl font-bold text-pine">{money(fixedTermResult.amount)}</p>
                  <p className="mt-3 text-xs text-muted">{t("fixedTermFormulaNote")}</p>
                  <p className="mt-1 text-xs text-muted">{t("fixedTermOnlyWhenEmployerEndsHint")}</p>
                  {entitlementsSection}
                </>
              ) : null)}

            {mode === "mutual_agreement" &&
              (mutualAgreementResult?.preOct2013NotSupported ? (
                <p className="text-sm text-muted">{t("preOct2013Message")}</p>
              ) : mutualAgreementResult ? (
                <>
                  <h2 className="font-display text-lg font-bold">{t("mutualAgreementResultHeading")}</h2>
                  {mutualAgreementResult.offeredAsPercentOfBenchmark != null && (
                    <p className="mt-3 font-display text-3xl font-bold text-pine">
                      {t("mutualAgreementPercentLine", { percent: mutualAgreementResult.offeredAsPercentOfBenchmark })}
                    </p>
                  )}
                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("mutualAgreementBenchmarkLine")}</dt>
                      <dd className="font-medium text-ink">{money(mutualAgreementResult.benchmarkSeverance.amount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("mutualAgreementTaxExemptLine")}</dt>
                      <dd className="font-medium text-ink">{money(mutualAgreementResult.taxExemption.exemptAmount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("mutualAgreementTaxableLine")}</dt>
                      <dd className="font-medium text-ink">{money(mutualAgreementResult.taxExemption.taxableAmount)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted">{t("mutualAgreementNoLegalMinimumNote")}</p>
                  <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-amber-800">
                    {t("mutualAgreementUnemploymentCaveat")}
                  </p>
                  {entitlementsSection}
                  <Link href="/jobs" className={`mt-4 block w-full text-center ${buttonClassName({ size: "md" })}`}>
                    {t("mutualAgreementJobsCta")}
                  </Link>
                </>
              ) : null)}

            {mode === "resignation" && resignationResult && (
              <>
                <h2 className="font-display text-lg font-bold">{t("resignationResultHeading")}</h2>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("resignationNoticeDaysRequiredLine")}</dt>
                    <dd className="font-medium text-ink">{resignationResult.noticeDaysRequired}</dd>
                  </div>
                  {resignationResult.shortfallDays > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted">{t("resignationShortfallLine")}</dt>
                      <dd className="font-medium text-ink">{resignationResult.shortfallDays}</dd>
                    </div>
                  )}
                </dl>
                {resignationResult.shortfallDays > 0 ? (
                  <p className="mt-3 font-display text-2xl font-bold text-pine">
                    {money(resignationResult.compensationOwed)}
                    <span className="ml-2 text-xs font-normal text-muted">{t("resignationCompensationOwedLine")}</span>
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-pine">{t("resignationNoShortfallMessage")}</p>
                )}
                {entitlementsSection}
              </>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="mt-4 h-9 w-full rounded-lg border border-line text-sm font-medium text-pine hover:bg-paper"
            >
              {copied ? t("copied") : t("shareButton")}
            </button>
          </div>

          <div className="rounded-xl border border-line bg-paper p-4 text-center">
            <h3 className="font-display text-sm font-bold">{t("ctaSalaryHeading")}</h3>
            <p className="mt-1 text-xs text-muted">{t("ctaSalaryBody")}</p>
            <Link
              href="/salario-liquido?mode=employment"
              className={`mt-3 block w-full text-center ${buttonClassName({ size: "md", variant: "secondary" })}`}
            >
              {t("ctaSalaryButton")}
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-paper p-4 text-sm">
        <h2 className="font-semibold">{t("infoHeading")}</h2>
        <dl className="mt-3 space-y-4">
          <div>
            <dt className="font-medium text-ink">{t("whatIsSeveranceTerm")}</dt>
            <dd className="mt-1 text-muted">{t("whatIsSeveranceBody")}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">{t("whatIsMutualAgreementTerm")}</dt>
            <dd className="mt-1 text-muted">{t("whatIsMutualAgreementBody")}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">{t("unemploymentEligibilityTerm")}</dt>
            <dd className="mt-1 text-muted">{t("unemploymentEligibilityBody")}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">{t("taxExemptionTerm")}</dt>
            <dd className="mt-1 text-muted">{t("taxExemptionBody")}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">{t("noticePeriodTerm")}</dt>
            <dd className="mt-1 text-muted">{t("noticePeriodBody")}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
