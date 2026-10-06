import type { Meta } from "../rules/schema";
import { d, round2 } from "./money";

/** Employee SS: 11% of taxable remuneration (base + subsidies + taxable
 *  meal excess). Employer: 23.75% — shown only in the "custo para a
 *  empresa" panel, never subtracted from the employee's own net (spec
 *  §3.3). */
export function calculateEmployeeSocialSecurity(taxableRemuneration: number, meta: Meta): number {
  return round2(d(taxableRemuneration).times(meta.socialSecurity.employeeRate));
}

export function calculateEmployerSocialSecurity(taxableRemuneration: number, meta: Meta): number {
  return round2(d(taxableRemuneration).times(meta.socialSecurity.employerRate));
}
