import type { MetadataRoute } from "next";

// Round-10 favicon implementation: the real exported icon set (see
// `docs/go-live-checklist.md` for where the source files live) covers the
// browser-tab favicon (`favicon.ico`/`icon.png`, Next's own App Router
// special-file convention — same minimal pattern `robots.ts`/`sitemap.ts`
// already use here, not a new mechanism) and the Apple touch icon
// (`apple-icon.png`). This manifest is the one piece those two conventions
// don't cover — Android/Chrome "add to home screen" icons — and didn't
// exist in any form before this, since there was no real icon art to back
// it. `theme_color`/`background_color` match the design system's own
// Primary/Background tokens (`--color-pine`/`--color-paper`).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Just IT",
    short_name: "Just IT",
    description: "Transparency-first IT job board for Portugal — every listing shows a salary.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#465bff",
    icons: [
      { src: "/android-chrome-192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
