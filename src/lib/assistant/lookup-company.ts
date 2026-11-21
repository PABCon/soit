export type CompanyVocabEntry = { slug: string; name: string };

/** The `lookupCompany` tool's full result shape, as the route's own
 *  `execute` actually builds it (match + `getCompanyBySlug` lookup):
 *  exported here, not just left as an inline object literal in the
 *  route, so the client can cast `part.output` to a real type instead
 *  of `unknown` when rendering it, the same convention
 *  `SearchJobsResult` already established. */
export type LookupCompanyToolResult =
  | { ok: false; reason: "not_found" }
  | {
      ok: true;
      slug: string;
      name: string;
      logoUrl: string | null;
      description: string | null;
      industry: string | null;
      companySize: string | null;
      openJobsCount: number;
    };

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** Same "never invent" discipline as `findMatchingTech` in
 *  `search-jobs.ts`: the model is never trusted to produce a real
 *  company slug directly, only a name guess, which gets defensively
 *  matched against the real company list here. Unlike tech tags,
 *  companies have no curated alias list and their real names are
 *  longer/less standardized ("ITDS" vs. "ITDS Portugal"), so an exact
 *  normalized match is tried first, falling back to a substring match
 *  only when it's unambiguous (exactly one real company contains, or is
 *  contained by, the query); an ambiguous substring match returns
 *  `null` rather than guessing which one the user meant. */
export function findMatchingCompany(query: string, vocab: CompanyVocabEntry[]): CompanyVocabEntry | null {
  const norm = normalize(query);
  if (!norm) return null;

  const exact = vocab.find((c) => normalize(c.name) === norm);
  if (exact) return exact;

  const substringMatches = vocab.filter((c) => {
    const n = normalize(c.name);
    return n.includes(norm) || norm.includes(n);
  });
  return substringMatches.length === 1 ? substringMatches[0] : null;
}
