import type { TerminationProfile } from "./engine/types";

export type TerminationCalculatorMode = "dismissal" | "fixed_term" | "mutual_agreement" | "resignation";

/** Same shareable-URL convention as salary-calculator's own
 *  url-state.ts: base64url JSON, nothing identifying by construction
 *  (no name/email field exists on any of these types), every mode's own
 *  inputs travel together so switching tabs after loading a shared link
 *  never resets the others back to their defaults. */
export type TerminationCalculatorState = {
  mode: TerminationCalculatorMode;
  profile: TerminationProfile;
  unusedPriorYearHolidayDays: number;
  mutualAgreementOfferedAmount: number;
  resignationContractType: "open_ended" | "fixed_term";
  resignationFixedTermOriginalDurationMonths: number;
  resignationNoticeDaysPlanned: number;
};

export function encodeState(state: TerminationCalculatorState): string {
  const json = JSON.stringify(state);
  if (typeof window === "undefined") return Buffer.from(json, "utf-8").toString("base64url");
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeState(encoded: string): TerminationCalculatorState | null {
  try {
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const json =
      typeof window === "undefined"
        ? Buffer.from(base64, "base64").toString("utf-8")
        : decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(json);
    if (!parsed?.profile || !parsed?.mode) return null;
    return parsed as TerminationCalculatorState;
  } catch {
    return null;
  }
}
