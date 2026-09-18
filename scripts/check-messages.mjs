#!/usr/bin/env node
/**
 * Message catalogue guard (§2.2).
 * Fails if the locales drift: a key present in one but missing in another, or
 * an empty string. Bilingual projects rot exactly here — a key added to one
 * catalogue renders as a raw key path in the other, and nobody notices until
 * a user does.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "messages";
const locales = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? flatten(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v]],
  );

const catalogues = Object.fromEntries(
  locales.map((l) => [
    l,
    new Map(flatten(JSON.parse(readFileSync(join(DIR, `${l}.json`), "utf8")))),
  ]),
);

const allKeys = [...new Set(locales.flatMap((l) => [...catalogues[l].keys()]))].sort();
const problems = [];

for (const key of allKeys) {
  for (const locale of locales) {
    const value = catalogues[locale].get(key);
    if (value === undefined) problems.push(`missing  ${locale}  ${key}`);
    else if (typeof value === "string" && value.trim() === "")
      problems.push(`empty    ${locale}  ${key}`);
  }
}

if (problems.length) {
  console.error(`✗ message catalogues out of sync (${problems.length} problems):`);
  for (const p of problems) console.error(`    ${p}`);
  process.exit(1);
}

console.log(`✓ ${locales.join(", ")} in sync — ${allKeys.length} keys each`);
