import Decimal from "decimal.js";
import type { IrsBracketsRuleSet } from "../rules/schema";
import type { MaritalStatus, AnnualIrsResult } from "./types";
import { d, round2 } from "./money";

function findIrsBracket(brackets: IrsBracketsRuleSet["brackets"], rendimentoColetavel: number) {
  for (const bracket of brackets) {
    if (bracket.upTo === null || rendimentoColetavel <= bracket.upTo) return bracket;
  }
  return brackets[brackets.length - 1];
}

/** coleta = coletável × rate − parcela (spec §6), before the solidarity
 *  surcharge. */
export function calculateColeta(rendimentoColetavel: number, irsBrackets: IrsBracketsRuleSet): Decimal {
  const bracket = findIrsBracket(irsBrackets.brackets, rendimentoColetavel);
  return d(rendimentoColetavel).times(bracket.rate).minus(bracket.parcela);
}

/** taxa adicional de solidariedade (spec §6) — a progressive surcharge
 *  layered on top of coleta: the portion of rendimento coletável between
 *  the first and second threshold is taxed at the first rate, and the
 *  portion above the second threshold at the second (already-cumulative)
 *  rate. Thresholds come from the region's own rule file, since Açores
 *  uses different rates (spec flags these as VERIFY). */
export function calculateSolidarityExtra(
  rendimentoColetavel: number,
  thresholds: IrsBracketsRuleSet["solidarityRate"]["thresholds"],
): Decimal {
  const sorted = [...thresholds].sort((a, b) => a.above - b.above);
  let extra = d(0);

  for (let i = 0; i < sorted.length; i++) {
    const { above, rate } = sorted[i];
    if (rendimentoColetavel <= above) break;
    const nextThreshold = sorted[i + 1]?.above;
    const bandTop = nextThreshold !== undefined ? Math.min(rendimentoColetavel, nextThreshold) : rendimentoColetavel;
    // Only the band between this threshold and the next (or the top, for
    // the last threshold) is taxed at THIS rate — the next threshold's
    // own rate already applies to everything above it.
    if (nextThreshold === undefined || rendimentoColetavel <= nextThreshold) {
      extra = extra.plus(d(bandTop - above).times(rate));
    }
  }

  return extra;
}

export type AnnualIrsDeductionInput = {
  dependents: number;
  dependentsUnder3: number;
  dependentsWithDisability: number;
  disabilityAbove60: boolean;
  maritalStatus: MaritalStatus;
  /** "despesas gerais familiares" toggle — spec §6 UI note: "assume full
   *  use", default on. */
  assumeFullDespesasGerais?: boolean;
};

/** Deduções à coleta (spec §6, v1 subset). Two real, stated gaps kept as
 *  code comments rather than invented numbers: (1) the Profile type has
 *  no "dependent aged ≤6" field distinct from "aged ≤3", so the "900 for
 *  2nd+ dependent aged ≤6" tier can't be resolved — every dependent past
 *  a single aged-≤3 case falls back to the flat 600 figure; (2) the spec
 *  gives the taxpayer's own disability deduction only for a non-married
 *  taxpayer — a married taxpayer's own disability deduction is left at 0,
 *  not guessed. mínimo de existência is VERIFY-flagged in the spec and
 *  not implemented at all yet. */
export function calculateDeducoesAColeta(
  input: AnnualIrsDeductionInput,
  deductions: IrsBracketsRuleSet["deductions"],
): Decimal {
  let total = d(0);

  if (input.dependents === 1 && input.dependentsUnder3 === 1 && deductions.dependentFirstAged3OrUnder != null) {
    total = total.plus(deductions.dependentFirstAged3OrUnder);
  } else if (input.dependents > 0) {
    total = total.plus(d(deductions.dependentFirst).times(input.dependents));
  }

  if (input.disabilityAbove60 && input.maritalStatus === "single") {
    total = total.plus(deductions.disabilityNonMarriedTaxpayer);
  }

  if (input.dependentsWithDisability > 0) {
    total = total.plus(d(deductions.disabilityDependent).times(input.dependentsWithDisability));
  }

  if (input.assumeFullDespesasGerais !== false) {
    total = total.plus(deductions.despesasGeraisFamiliaresMax);
  }

  return total;
}

export function calculateAnnualIrs(params: {
  rendimentoColetavel: number;
  withheld: number;
  irsBrackets: IrsBracketsRuleSet;
  deductionInput: AnnualIrsDeductionInput;
  includeDeductions: boolean;
}): AnnualIrsResult {
  const coleta = calculateColeta(params.rendimentoColetavel, params.irsBrackets);
  const solidarityExtra = calculateSolidarityExtra(
    params.rendimentoColetavel,
    params.irsBrackets.solidarityRate.thresholds,
  );
  const deducoes = params.includeDeductions
    ? calculateDeducoesAColeta(params.deductionInput, params.irsBrackets.deductions)
    : d(0);

  const irsLiquidado = Decimal.max(d(0), coleta.plus(solidarityExtra).minus(deducoes));
  const settlement = irsLiquidado.minus(params.withheld);

  return {
    rendimentoColetavel: params.rendimentoColetavel,
    coleta: round2(coleta),
    solidarityExtra: round2(solidarityExtra),
    deducoes: round2(deducoes),
    irsLiquidado: round2(irsLiquidado),
    withheld: round2(params.withheld),
    settlement: round2(settlement),
  };
}
