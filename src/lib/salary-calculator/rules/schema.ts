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
