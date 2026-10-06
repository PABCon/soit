import { z } from "zod";

// §0 rule #1/#2: every rate/bracket/threshold/coefficient/table lives in
// versioned JSON under /rules, transcribed from an official source, never
// hard-coded in a .ts file. This schema is what validates those JSON files
// at load time — a malformed or hand-edited rule file fails loudly instead
// of silently producing wrong withholding numbers.

const parcelaFixedSchema = z.object({
  type: z.literal("fixed"),
  value: z.number(),
});

const parcelaFormulaSchema = z.object({
  type: z.literal("formula"),
  rate: z.number(),
  k: z.number(),
  c: z.number(),
});

export const parcelaSchema = z.union([parcelaFixedSchema, parcelaFormulaSchema]);

export const withholdingBracketSchema = z.object({
  upTo: z.number().nullable(),
  rate: z.number(),
  parcela: parcelaSchema,
  perDependent: z.number(),
});

export const withholdingTableSchema = z.object({
  label: z.string(),
  disability: z.boolean(),
  brackets: z.array(withholdingBracketSchema),
});

export const withholdingRuleSetSchema = z.object({
  region: z.enum(["continente", "madeira", "acores"]),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  source: z.string(),
  tables: z.record(z.string(), withholdingTableSchema),
});

export type WithholdingRuleSet = z.infer<typeof withholdingRuleSetSchema>;
export type WithholdingTable = z.infer<typeof withholdingTableSchema>;
export type WithholdingBracket = z.infer<typeof withholdingBracketSchema>;
export type Parcela = z.infer<typeof parcelaSchema>;

export const irsBracketSchema = z.object({
  upTo: z.number().nullable(),
  rate: z.number(),
  parcela: z.number(),
});

export const irsBracketsRuleSetSchema = z.object({
  region: z.enum(["continente", "madeira", "acores"]),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  source: z.string(),
  brackets: z.array(irsBracketSchema),
  solidarityRate: z.object({
    note: z.string(),
    thresholds: z.array(z.object({ above: z.number(), rate: z.number() })),
  }),
  deductions: z.object({
    dependentFirst: z.number(),
    dependentFirstAged3OrUnder: z.number().nullable(),
    dependentSecondPlusAged6OrUnder: z.number(),
    disabilityTaxpayer: z.number(),
    disabilityDependent: z.number(),
    despesasGeraisFamiliaresMax: z.number(),
    note: z.string(),
  }),
});

export type IrsBracketsRuleSet = z.infer<typeof irsBracketsRuleSetSchema>;

export const metaSchema = z.object({
  year: z.number(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  ias: z.number(),
  irsJovemExemptionCap: z.object({ multipleOfIas: z.number(), value: z.number() }),
  mealAllowance: z.object({
    cashExemptDaily: z.number(),
    cardExemptDaily: z.number(),
    cardExemptDailyDisplay: z.number(),
  }),
  socialSecurity: z.object({
    employeeRate: z.number(),
    employerRate: z.number(),
  }),
  source: z.string(),
});

export type Meta = z.infer<typeof metaSchema>;

// Mode B: recibos verdes (independent worker) — §4.

export const ssIndependentRuleSetSchema = z.object({
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  source: z.string(),
  rate: z.number(),
  relevantIncomePct: z.object({ services: z.number(), goods: z.number() }),
  exemptFirstMonths: z.number(),
  minimumMonthlyContribution: z.number(),
  maximumMonthlyBase: z.object({ multipleOfIas: z.number() }),
  acumulacaoExemption: z.object({
    thresholdMultipleOfIas: z.number(),
    note: z.string(),
  }),
  baseAdjustment: z.object({ minPct: z.number(), maxPct: z.number(), stepPct: z.number() }),
});
export type SsIndependentRuleSet = z.infer<typeof ssIndependentRuleSetSchema>;

export const catBRuleSetSchema = z.object({
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  source: z.string(),
  coefficients: z.object({ art151: z.number(), otherServices: z.number() }),
  newActivityReduction: z.object({ year1: z.number(), year2: z.number() }),
  withholdingRates: z.object({ art151: z.number(), otherServices: z.number() }),
  dispensaThresholdAnnual: z.number(),
  ificiRate: z.number(),
  justificationRule: z.object({
    requiredPct: z.number(),
    fixedDeduction: z.number(),
    ssExcessThresholdPct: z.number(),
  }),
});
export type CatBRuleSet = z.infer<typeof catBRuleSetSchema>;

export const vatRuleSetSchema = z.object({
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  source: z.string(),
  rates: z.object({ continente: z.number(), madeira: z.number(), acores: z.number() }),
  exemptionThresholdAnnual: z.number(),
  exemptionLossThresholdAnnual: z.number(),
});
export type VatRuleSet = z.infer<typeof vatRuleSetSchema>;

// Mode C: empresa própria (Sociedade Unipessoal Lda) — §5.

export const ircRuleSetSchema = z.object({
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  source: z.string(),
  sme: z.object({ lowRate: z.number(), lowRateCeiling: z.number(), highRate: z.number() }),
  nonSme: z.object({ rate: z.number() }),
  dividendTaxRate: z.number(),
  gerenteSs: z.object({ companyRate: z.number(), memberRate: z.number() }),
  municipalSurcharge: z.object({ minPct: z.number(), maxPct: z.number(), defaultPct: z.number() }),
});
export type IrcRuleSet = z.infer<typeof ircRuleSetSchema>;
