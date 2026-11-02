import { defineConfig } from "vitest/config";
import path from "node:path";

// Every existing test avoided the "@/*" alias (tsconfig.json) entirely,
// using relative imports instead — Vitest has no alias resolution of its
// own without this file, so any module under test that itself imports via
// "@/..." (most of this codebase does) fails to resolve at test time with
// no config at all. Mirrors tsconfig.json's mapping exactly.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
