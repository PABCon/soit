import { describe, expect, it } from "vitest";
import { findMatchingCompany, type CompanyVocabEntry } from "./lookup-company";

const VOCAB: CompanyVocabEntry[] = [
  { slug: "itds-portugal", name: "ITDS Portugal" },
  { slug: "acme", name: "Acme Software" },
];

describe("findMatchingCompany", () => {
  it("matches an exact, case-insensitive company name", () => {
    expect(findMatchingCompany("itds portugal", VOCAB)).toEqual(VOCAB[0]);
  });

  it("matches an unambiguous substring (a short, common way to refer to a company)", () => {
    expect(findMatchingCompany("ITDS", VOCAB)).toEqual(VOCAB[0]);
  });

  it("returns null for a company name that doesn't exist, rather than guessing", () => {
    expect(findMatchingCompany("Totally Made Up Inc", VOCAB)).toBeNull();
  });

  it("returns null for an ambiguous substring matching more than one real company", () => {
    const ambiguousVocab: CompanyVocabEntry[] = [
      { slug: "acme-software", name: "Acme Software" },
      { slug: "acme-consulting", name: "Acme Consulting" },
    ];
    expect(findMatchingCompany("Acme", ambiguousVocab)).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(findMatchingCompany("", VOCAB)).toBeNull();
  });
});
