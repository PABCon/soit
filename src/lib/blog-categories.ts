/**
 * Split out of blog.ts on purpose: that module has top-level `node:fs`/
 * `gray-matter`/`remark` imports, which Next bundles into a client chunk
 * in full the moment ANY client component imports anything from it —
 * even just this plain array — and `node:fs` can't ship to the browser
 * (confirmed by a real Turbopack build failure: "the chunking context
 * does not support external modules (request: node:fs)"). This file has
 * zero server-only dependencies, so client components (the category
 * filter tabs) can safely import from here instead.
 */
export const CATEGORIES = ["career", "tech", "companies", "market", "tips"] as const;
export type BlogCategory = (typeof CATEGORIES)[number];
