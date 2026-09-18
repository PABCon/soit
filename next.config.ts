import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Pin the workspace root: an unrelated lockfile higher up the tree would
  // otherwise be inferred as the root.
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
};

export default withNextIntl(nextConfig);
