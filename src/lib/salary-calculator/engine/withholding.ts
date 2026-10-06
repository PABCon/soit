import Decimal from "decimal.js";
import { getWithholdingRuleSet, getMeta } from "../rules/loader";
import type { Parcela, WithholdingTable } from "../rules/schema";
import type { Profile, MonthlyWithholdingResult, IrsJovemBenefitYear } from "./types";
import { d, round2 } from "./money";

/** Resolves which of the 7 official withholding tables (I-VII) applies —
 *  the spec's own build doc flagged "VERIFY exact mapping IV-VII" as an
 *  open question; resolved here directly from the real AT-published
 *  spreadsheets (Tabelas_RF_*_2026.xlsx), not guessed:
 *
 *  - Table I: single, no dependents — OR married, two earners (dependents
 *    don't move a two-earner household off Table I; its own
 *    perDependent figure still applies).
 *  - Table II: single, with dependents.
 *  - Table III: married, single earner.
 *  - Tables IV-VII mirror I-III exactly, but for a taxpayer with a
 *    qualifying disability — except married-two-earners-with-dependents
 *    gets its OWN table (VI) once disability is involved, a distinction
 *    that doesn't exist in the non-disability set (I covers two-earner
 *    households regardless of dependents there). VII is the disability
 *    counterpart of III.
 */
export function selectWithholdingTableKey(profile: Pick<Profile, "maritalStatus" | "dependents" | "disabilityAbove60">): string {
  const hasDependents = profile.dependents > 0;

  if (!profile.disabilityAbove60) {
    if (profile.maritalStatus === "married_single_earner") return "III";
    if (profile.maritalStatus === "married_two_earners") return "I";
    return hasDependents ? "II" : "I";
  }

  if (profile.maritalStatus === "married_single_earner") return "VII";
  if (profile.maritalStatus === "married_two_earners") return hasDependents ? "VI" : "IV";
  return hasDependents ? "V" : "IV";
}

function findBracket(table: WithholdingTable, taxableRemuneration: number) {
  for (const bracket of table.brackets) {
    if (bracket.upTo === null || taxableRemuneration <= bracket.upTo) return bracket;
  }
  return table.brackets[table.brackets.length - 1];
}

function parcelaValue(parcela: Parcela, taxableRemuneration: number) {
  if (parcela.type === "fixed") return d(parcela.value);
  // rate × k × (c − R) — the transitional-bracket formula a handful of
  // tables use instead of a flat parcela (spec §3.2).
  return d(parcela.rate).times(parcela.k).times(d(parcela.c).minus(taxableRemuneration));
}

const IRS_JOVEM_EXEMPTION_PCT: Record<IrsJovemBenefitYear, number> = {
  1: 1.0,
  2: 0.75,
  3: 0.75,
  4: 0.75,
  5: 0.5,
  6: 0.5,
  7: 0.5,
  8: 0.25,
  9: 0.25,
  10: 0.25,
};

/** Monthly withholding for Cat A income (spec §3.2).
 *
 *  `taxableRemuneration` (R) = base + taxable part of meal allowance +
 *  other taxable — the caller (mode-a.ts) assembles this; this function
 *  only ever does the bracket/table lookup and the formula itself. */
export function calculateMonthlyWithholding(
  profile: Profile,
  taxableRemuneration: number,
): MonthlyWithholdingResult {
  if (profile.flatRate20) {
    // IFICI/RNH: flat 20%, no table or dependent logic at all (spec §3.2).
    return {
      retention: round2(d(taxableRemuneration).times(0.2)),
      tableUsed: "IFICI_FLAT_20",
      rate: 0.2,
      taxableRemuneration,
    };
  }

  const ruleSet = getWithholdingRuleSet(profile.region, profile.year, profile.month);
  const tableKey = selectWithholdingTableKey(profile);
  const table = ruleSet.tables[tableKey];
  if (!table) throw new Error(`No withholding table "${tableKey}" for region=${profile.region}`);

  const bracket = findBracket(table, taxableRemuneration);
  const parcela = parcelaValue(bracket.parcela, taxableRemuneration);
  const dependentDeduction = d(bracket.perDependent).times(profile.dependents);

  let effectiveR = d(taxableRemuneration);

  // IRS Jovem (spec §3.2 + §6): the employer determines the marginal rate
  // on the FULL remuneration, but only withholds on the non-exempt
  // portion. VERIFY the exact mechanic in art. 2.º-B CIRS — this is a
  // reasonable, literal reading of the spec text, not independently
  // confirmed against the despacho, and (unlike the base/IFICI paths
  // above) isn't covered by a Phase-1 test case. A real year-to-date
  // cumulative cap tracker is Phase 2+ scope; this prorates the annual
  // cap evenly across 12 months as a simplification.
  if (profile.irsJovem.enabled) {
    const meta = getMeta(profile.year);
    const exemptionPct = IRS_JOVEM_EXEMPTION_PCT[profile.irsJovem.benefitYear];
    const monthlyCapShare = meta.irsJovemExemptionCap.value / 12;
    const exemptAmount = Decimal.min(d(taxableRemuneration).times(exemptionPct), d(monthlyCapShare));
    effectiveR = Decimal.max(d(0), d(taxableRemuneration).minus(exemptAmount));
  }

  const retention = Decimal.max(
    d(0),
    effectiveR.times(bracket.rate).minus(parcela).minus(dependentDeduction),
  );

  return {
    retention: round2(retention),
    tableUsed: tableKey,
    rate: bracket.rate,
    taxableRemuneration,
  };
}
