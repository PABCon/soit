/**
 * Portuguese NIF/NIPC layer-1 validation (spec §5.7.2) — offline, instant,
 * pure arithmetic. This is the one piece that must never be wrong, so it
 * has no dependency on anything remote; see src/lib/verification for the
 * async layers.
 *
 * The checksum alone is not a business check — 000000000 passes it. The
 * leading digits carry the entity type, and that is what actually gates
 * registration: only companies (5), public entities (6) and non-resident
 * collective entities (71/72) are accepted. Everything else — sole traders
 * (1/2/3/45) trading under a personal NIF, condominiums, and any other
 * prefix — is rejected as not a business entity, by simply not being on
 * the allowlist.
 */

export type NifValidation =
  | { valid: true; nif: string }
  | { valid: false; reason: "format" | "checksum" | "not_business" };

const ACCEPTED_PREFIXES = ["5", "6", "71", "72"];

function checksumDigit(digits: number[]): number {
  const sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * (9 - i), 0);
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

export function validateNif(raw: string): NifValidation {
  const nif = raw.replace(/\D/g, "");

  if (nif.length !== 9 || !/^\d{9}$/.test(nif)) {
    return { valid: false, reason: "format" };
  }

  const digits = nif.split("").map(Number);
  if (digits[8] !== checksumDigit(digits)) {
    return { valid: false, reason: "checksum" };
  }

  if (!ACCEPTED_PREFIXES.some((p) => nif.startsWith(p))) {
    return { valid: false, reason: "not_business" };
  }

  return { valid: true, nif };
}
