# SóIT

A transparency-first IT job board for the Portuguese market. *Só* is Portuguese
for *only*: only IT, and only real salaries.

**Two rules define the product:**

1. **Every listing shows a salary range** — amount, period, and employment type.
   Posting without one is blocked. "2000–3000" is ambiguous in a market that
   quotes monthly gross over 14 months, so the salary is never rendered
   without its unit.
2. **Every employer is a verified business entity**, validated by NIF.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · TypeScript · Supabase
(Postgres + Auth + Storage) · `next-intl` · Vercel.

The candidate surface is server-rendered and individually crawlable — discovery
leans on organic search and Google for Jobs, and a client-rendered SPA fails to
get indexed, killing that channel silently.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

Then open http://localhost:3000 — it redirects to `/pt` or `/en` based on your
`Accept-Language`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run check` | Message-catalogue parity + lint + typecheck |
| `npm run check:i18n` | Fails if the PT and EN catalogues have drifted |

## Layout

```
docs/                     The spec. Source of truth — read it first.
  mvp-build-spec.md       Architecture, data model, security, build sequence
  flows/*.mmd             Mermaid flows, importable into Miro
messages/{pt,en}.json     UI strings. Both locales, always in sync.
src/
  i18n/                   Locale routing, request config, navigation helpers
  proxy.ts                Locale negotiation (Next 16's middleware convention)
  app/[locale]/
    (candidate)/          Public job site — SEO critical
    (console)/recruit/    Employer console — behind login, noindex
  components/Salary.tsx   The one salary component. Never render one ad hoc.
  lib/supabase/           Browser and server clients
```

## Conventions

- **Bilingual PT + EN**, both locale-prefixed. Every string goes through
  `next-intl`; `npm run check:i18n` fails on catalogue drift.
- Import `Link` / `redirect` / `usePathname` / `useRouter` from
  `@/i18n/navigation`, never from `next/*` — they must be locale-aware.
- The brand is **SóIT**; every machine-readable identifier is ASCII **`soit`**.
- **RLS is the security model.** Never filter by tenant in client code.

## Status

Build sequence is §14 of the spec. **Step 1 complete** (skeleton, i18n, both
shells, design tokens). **Step 2 complete** (schema, RLS, storage buckets) —
migrations are applied and verified against the live Supabase project; see
`supabase/migrations/README.md`. Next: step 3 — auth + employer verification.
