import severance202601 from "./2026/severance.2026-01.json";
import fixedTerm202601 from "./2026/fixed-term.2026-01.json";
import resignation202601 from "./2026/resignation.2026-01.json";
import meta2026 from "./2026/meta.json";
import {
  severanceRuleSetSchema,
  fixedTermRuleSetSchema,
  resignationRuleSetSchema,
  terminationMetaSchema,
  type SeveranceRuleSet,
  type FixedTermRuleSet,
  type ResignationRuleSet,
  type TerminationMeta,
} from "./schema";

// Same `effective_from`/`effective_to` + "pick the most recent rule set
// that actually covers this date" pattern as
// src/lib/salary-calculator/rules/loader.ts: a future legal change is a
// new JSON file, never an edit to existing engine code.

const SEVERANCE_RULE_SETS: SeveranceRuleSet[] = [severanceRuleSetSchema.parse(severance202601)];
const FIXED_TERM_RULE_SETS: FixedTermRuleSet[] = [fixedTermRuleSetSchema.parse(fixedTerm202601)];
const RESIGNATION_RULE_SETS: ResignationRuleSet[] = [resignationRuleSetSchema.parse(resignation202601)];
const META_RULE_SETS: TerminationMeta[] = [terminationMetaSchema.parse(meta2026)];

function isEffective(effectiveFrom: string, effectiveTo: string | null, asOfDate: string): boolean {
  const asOf = Date.parse(asOfDate);
  const from = Date.parse(effectiveFrom);
  if (asOf < from) return false;
  if (effectiveTo && asOf >= Date.parse(effectiveTo)) return false;
  return true;
}

function pickEffective<T extends { effective_from: string; effective_to: string | null }>(
  candidates: T[],
  asOfDate: string,
): T | null {
  const matching = candidates.filter((r) => isEffective(r.effective_from, r.effective_to, asOfDate));
  return matching.at(-1) ?? null;
}

export function getSeveranceRuleSet(asOfDate: string): SeveranceRuleSet {
  const chosen = pickEffective(SEVERANCE_RULE_SETS, asOfDate);
  if (!chosen) throw new Error(`No severance rule set effective on ${asOfDate}`);
  return chosen;
}

export function getFixedTermRuleSet(asOfDate: string): FixedTermRuleSet {
  const chosen = pickEffective(FIXED_TERM_RULE_SETS, asOfDate);
  if (!chosen) throw new Error(`No fixed-term rule set effective on ${asOfDate}`);
  return chosen;
}

export function getResignationRuleSet(asOfDate: string): ResignationRuleSet {
  const chosen = pickEffective(RESIGNATION_RULE_SETS, asOfDate);
  if (!chosen) throw new Error(`No resignation rule set effective on ${asOfDate}`);
  return chosen;
}

export function getTerminationMeta(year: number): TerminationMeta {
  const found = META_RULE_SETS.find((m) => m.year === year);
  if (!found) throw new Error(`No termination-calculator meta for year=${year}`);
  return found;
}
