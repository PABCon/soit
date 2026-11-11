import { z } from "zod";

// Same discipline as src/lib/salary-calculator/rules/schema.ts: every
// rate/day-count/cap lives in versioned JSON under /rules, transcribed
// from a cited official source, never hard-coded in a .ts file. This
// schema validates those JSON files at load time: a malformed or
// hand-edited rule file fails loudly instead of silently producing a
// wrong severance figure.

export const severanceRuleSetSchema = z.object({
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  dayRatePerYear: z.number(),
  salaryBaseCapMultiplierOfRmmg: z.number(),
  totalCapMultiplierOfMonths: z.number(),
  source: z.string(),
});
export type SeveranceRuleSet = z.infer<typeof severanceRuleSetSchema>;

export const fixedTermRuleSetSchema = z.object({
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  dayRatePerYear: z.number(),
  source: z.string(),
});
export type FixedTermRuleSet = z.infer<typeof fixedTermRuleSetSchema>;

export const resignationRuleSetSchema = z.object({
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  openEndedNoticeDaysShortTenure: z.number(),
  openEndedNoticeDaysLongTenure: z.number(),
  openEndedTenureThresholdYears: z.number(),
  fixedTermNoticeDaysShortContract: z.number(),
  fixedTermNoticeDaysLongContract: z.number(),
  fixedTermContractDurationThresholdMonths: z.number(),
  source: z.string(),
});
export type ResignationRuleSet = z.infer<typeof resignationRuleSetSchema>;

export const terminationMetaSchema = z.object({
  year: z.number(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  rmmg: z.number(),
  taxExemptionCapMultiplierOfRmmg: z.number(),
  source: z.string(),
});
export type TerminationMeta = z.infer<typeof terminationMetaSchema>;
