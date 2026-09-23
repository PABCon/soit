import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Pin the workspace root: an unrelated lockfile higher up the tree would
  // otherwise be inferred as the root.
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  experimental: {
    serverActions: {
      // Next's own default (1MB) is below the `branding` storage bucket's
      // 2MB image cap (supabase/migrations/20260921120200_storage.sql), so
      // any logo/cover upload between 1-2MB — which the bucket would
      // otherwise accept — crashed with a raw framework 500 before
      // uploadImageAction's own file-size check ever got a chance to run.
      bodySizeLimit: "3mb",
    },
  },
};

export default withNextIntl(nextConfig);
