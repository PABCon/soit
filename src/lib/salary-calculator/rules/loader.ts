import continente202601 from "./2026/withholding/continente.2026-01.json";
import madeira202601 from "./2026/withholding/madeira.2026-01.json";
import acores202601 from "./2026/withholding/acores.2026-01.json";
import irsContinente2026 from "./2026/irs-brackets/continente.json";
import meta2026 from "./2026/meta.json";
import ssIndependent202601 from "./2026/ss-independent.2026-01.json";
import catB202601 from "./2026/cat-b.2026-01.json";
import vat202601 from "./2026/vat.2026-01.json";
import irc202601 from "./2026/irc.2026-01.json";
import {
  withholdingRuleSetSchema,
  irsBracketsRuleSetSchema,
  metaSchema,
  ssIndependentRuleSetSchema,
  catBRuleSetSchema,
  vatRuleSetSchema,
  ircRuleSetSchema,
  type WithholdingRuleSet,
  type IrsBracketsRuleSet,
  type Meta,
  type SsIndependentRuleSet,
  type CatBRuleSet,
  type VatRuleSet,
  type IrcRuleSet,
} from "./schema";

export type Region = "continente" | "madeira" | "acores";

// §0 rule #3: withholding tables change mid-year — each rule set carries
// effective_from/effective_to, and the engine picks the one that covers the
// user's selected year+month. Only one rule set per region exists yet
// (2026-01-01 onward); a "2026-11" set slots in here the day it's published
// without touching any engine code.
const WITHHOLDING_RULE_SETS: Record<Region, WithholdingRuleSet[]> = {
  continente: [withholdingRuleSetSchema.parse(continente202601)],
  madeira: [withholdingRuleSetSchema.parse(madeira202601)],
  acores: [withholdingRuleSetSchema.parse(acores202601)],
};

const IRS_BRACKET_RULE_SETS: Record<Region, IrsBracketsRuleSet[]> = {
  continente: [irsBracketsRuleSetSchema.parse(irsContinente2026)],
  // Madeira/Açores annual IRS brackets are Phase 2 scope (spec §11) — not
  // transcribed yet, deliberately absent rather than guessed.
  madeira: [],
  acores: [],
};

const META_RULE_SETS: Meta[] = [metaSchema.parse(meta2026)];

const SS_INDEPENDENT_RULE_SETS: SsIndependentRuleSet[] = [ssIndependentRuleSetSchema.parse(ssIndependent202601)];
const CAT_B_RULE_SETS: CatBRuleSet[] = [catBRuleSetSchema.parse(catB202601)];
const VAT_RULE_SETS: VatRuleSet[] = [vatRuleSetSchema.parse(vat202601)];
const IRC_RULE_SETS: IrcRuleSet[] = [ircRuleSetSchema.parse(irc202601)];

function isEffective(effectiveFrom: string, effectiveTo: string | null, year: number, month: number): boolean {
  const asOf = Date.UTC(year, month - 1, 1);
  const from = Date.parse(effectiveFrom);
  if (asOf < from) return false;
  if (effectiveTo && asOf >= Date.parse(effectiveTo)) return false;
  return true;
}

/** Most-recently-effective rule set covering `year`/`month` — not just "the
 *  only one", so a future mid-year table change picks the right one
 *  automatically once that rule set file is added (§0 rule #3). */
function pickEffective<T extends { effective_from: string; effective_to: string | null }>(
  candidates: T[],
  year: number,
  month: number,
): T | null {
  const matching = candidates.filter((r) => isEffective(r.effective_from, r.effective_to, year, month));
  return matching.at(-1) ?? null;
}

export function getWithholdingRuleSet(region: Region, year: number, month: number): WithholdingRuleSet {
  const chosen = pickEffective(WITHHOLDING_RULE_SETS[region], year, month);
  if (!chosen) throw new Error(`No withholding rule set for region=${region} ${year}-${month}`);
  return chosen;
}

export function getIrsBracketsRuleSet(region: Region, year: number, month: number): IrsBracketsRuleSet {
  const chosen = pickEffective(IRS_BRACKET_RULE_SETS[region], year, month);
  if (!chosen) throw new Error(`No annual IRS brackets rule set for region=${region} ${year}-${month}`);
  return chosen;
}

export function getMeta(year: number): Meta {
  const found = META_RULE_SETS.find((m) => m.year === year);
  if (!found) throw new Error(`No meta rule set for year=${year}`);
  return found;
}

export function getSsIndependentRuleSet(year: number, month: number): SsIndependentRuleSet {
  const chosen = pickEffective(SS_INDEPENDENT_RULE_SETS, year, month);
  if (!chosen) throw new Error(`No independent-worker SS rule set for ${year}-${month}`);
  return chosen;
}

export function getCatBRuleSet(year: number, month: number): CatBRuleSet {
  const chosen = pickEffective(CAT_B_RULE_SETS, year, month);
  if (!chosen) throw new Error(`No Cat B rule set for ${year}-${month}`);
  return chosen;
}

export function getVatRuleSet(year: number, month: number): VatRuleSet {
  const chosen = pickEffective(VAT_RULE_SETS, year, month);
  if (!chosen) throw new Error(`No VAT rule set for ${year}-${month}`);
  return chosen;
}

export function getIrcRuleSet(year: number, month: number): IrcRuleSet {
  const chosen = pickEffective(IRC_RULE_SETS, year, month);
  if (!chosen) throw new Error(`No IRC rule set for ${year}-${month}`);
  return chosen;
}
