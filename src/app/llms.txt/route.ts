// AI/answer-engine audit finding: no llms.txt existed at all. This is
// the emerging (llmstxt.org), not-yet-universal convention giving an AI
// crawler a short, curated, plain-text summary of the site and its most
// useful pages, the same role robots.txt/sitemap.xml play for search
// crawlers, but written for an LLM to read directly rather than parse.
// No Next.js file convention covers this (unlike robots.ts/sitemap.ts),
// so this is a plain route handler at the literal `/llms.txt` path.
// Content is deliberately factual and sourced from this project's own
// already-approved copy/real data, never invented: the salary-range
// requirement is stated as "every posting must include one," not "every
// listing always shows one publicly": a Top Employer subscriber can
// choose to hide a job's salary from public view (one real case exists
// today out of 105 live listings), so the stronger claim would be a real
// overstatement, even though it's accurate for the overwhelming majority.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function body(): string {
  return `# Just IT

> Just IT is an IT-focused job board for Portugal. Every employer is a verified registered business (checked against the Portuguese NIF registry), and every job posting must include a real, numeric salary range before it can be published. Candidates browse and apply for free; employers post via pay-per-ad credits or a Top Employer subscription.

Bilingual site (Portuguese and English), both fully locale-prefixed: ${SITE}/pt/ and ${SITE}/en/.

## Core pages

- [Job listings](${SITE}/pt/jobs): Live IT job postings in Portugal, filterable by location, technology, seniority, work model and salary.
- [Companies](${SITE}/pt/companies): Public profiles of verified employers hiring IT talent in Portugal.
- [Net salary calculator](${SITE}/pt/salario-liquido): A free, open calculator for take-home pay in Portugal, covering employment contracts, freelance work (recibos verdes), and running your own company (Lda).
- [Interview preparation](${SITE}/pt/preparacao-entrevista): Resources for candidates preparing for an IT job interview in Portugal.
- [API documentation](${SITE}/developers): Public reference for the Just IT API (programmatic job posting for employers).

## Guides

- [Employment contract guide](${SITE}/pt/guia/contrato-trabalho): How payslips, income tax withholding, and social security work for an IT employee in Portugal.
- [Recibos verdes guide](${SITE}/pt/guia/recibos-verdes): How freelance/independent-contractor taxation works in Portugal.
- [Own company guide](${SITE}/pt/guia/empresa-propria): How running your own company compares, tax-wise, to being employed or freelance.
- [Blog](${SITE}/pt/blog): Articles on IT careers and recruitment in Portugal.
`;
}

export async function GET() {
  return new Response(body(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
