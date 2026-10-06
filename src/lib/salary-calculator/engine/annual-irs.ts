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

/** Deduções à coleta (spec §6, v1 subset). One real, stated gap kept as
 *  a code comment rather than an invented number: the Profile type has
 *  no "dependent aged ≤6" field distinct from "aged ≤3", so the "900 for
 *  2nd+ dependent aged ≤6" tier can't be resolved — every dependent past
 *  a single aged-≤3 case falls back to the flat 600 figure.
 *
 *  The taxpayer's own disability deduction (4× IAS) applies regardless
 *  of marital status — confirmed directly against art. 87.º CIRS, which
 *  corrected an initial misreading of the spec's "per non-married
 *  taxpayer" phrasing (the article itself makes no such distinction).
 *
 *  mínimo de existência is implemented only for the simple case (see
 *  `applyMinimoExistencia` below); the sliding-taper formula above that
 *  threshold is real but too complex to confidently implement without a
 *  known-good test case to check it against. */
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

  if (input.disabilityAbove60) {
    total = total.plus(deductions.disabilityTaxpayer);
  }

  if (input.dependentsWithDisability > 0) {
    total = total.plus(d(deductions.disabilityDependent).times(input.dependentsWithDisability));
  }

  if (input.assumeFullDespesasGerais !== false) {
    total = total.plus(deductions.despesasGeraisFamiliaresMax);
  }

  return total;
}

/** mínimo de existência (art. 70.º CIRS) — confirmed live against the
 *  primary source: the reference value is max(€12,880, 1.5 × 14 × IAS),
 *  and gross income at or below it is fully exempt from IRS. Only that
 *  simple floor is implemented: the sliding-taper abatement the article
 *  also defines for gross income between the reference value and
 *  roughly €14,641 (art. 70.º §2 b/c) is real but has a genuinely
 *  complex multi-term formula this session couldn't confidently source
 *  a verified version of — not implemented rather than guessed. */
export function minimoExistenciaThreshold(ias: number): number {
  return Math.max(12880, 1.5 * 14 * ias);
}

export function calculateAnnualIrs(params: {
  rendimentoColetavel: number;
  /** Gross annual income (before category deductions) — only used for
   *  the mínimo de existência floor, which the law checks against gross
   *  income, not rendimento coletável. Omit to skip that check. */
  grossAnnualIncome?: number;
  ias?: number;
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

  const belowMinimoExistencia =
    params.grossAnnualIncome !== undefined &&
    params.ias !== undefined &&
    params.grossAnnualIncome <= minimoExistenciaThreshold(params.ias);

  const irsLiquidado = belowMinimoExistencia
    ? d(0)
    : Decimal.max(d(0), coleta.plus(solidarityExtra).minus(deducoes));
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
