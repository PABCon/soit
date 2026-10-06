import type { Profile, EmploymentInput } from "./engine/types";

/** Shareable state (spec §10) — "shareable URL with state encoded (base64
 *  JSON of the inputs, same idea as Doutor Finanças). Good for SEO and
 *  sharing; never put email or personal data in it." Profile + Mode A
 *  input only — nothing identifying, matches that rule by construction. */
export type SalaryCalculatorState = {
  profile: Profile;
  input: EmploymentInput;
};

export function encodeState(state: SalaryCalculatorState): string {
  const json = JSON.stringify(state);
  if (typeof window === "undefined") return Buffer.from(json, "utf-8").toString("base64url");
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeState(encoded: string): SalaryCalculatorState | null {
  try {
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const json =
      typeof window === "undefined"
        ? Buffer.from(base64, "base64").toString("utf-8")
        : decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(json);
    if (!parsed?.profile || !parsed?.input) return null;
    return parsed as SalaryCalculatorState;
  } catch {
    return null;
  }
}
