import Decimal from "decimal.js";

// Same wrapper as src/lib/salary-calculator/engine/money.ts, duplicated
// rather than imported across features, keeps the already-shipped
// salary calculator untouched by this unrelated feature.

export function d(value: number | string | Decimal): Decimal {
  return new Decimal(value);
}

export function round2(value: Decimal | number): number {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}
