import Decimal from "decimal.js";

// §0 rule #4: money in integer cents or decimal.js — no floats for money.
// Every multi-step calculation in this engine runs through Decimal and
// only converts back to a plain `number` (rounded to cents) at the very
// end, so intermediate steps never accumulate binary floating-point error.

export function d(value: number | string | Decimal): Decimal {
  return new Decimal(value);
}

/** Rounds to cents using standard "round half away from zero", matching
 *  how Portuguese payroll/tax amounts are conventionally rounded. VERIFY
 *  the exact rounding direction for withholding amounts against Despacho
 *  233-A/2026 before this ships (spec §0 rule #4 flags this explicitly). */
export function round2(value: Decimal | number): number {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}
