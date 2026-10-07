import { describe, expect, it } from "vitest";
import { findLogoCandidate } from "./extract-company-profile";

describe("findLogoCandidate", () => {
  it("prefers an Open Graph image when present", () => {
    const html = `
      <html><head>
        <link rel="icon" href="/favicon.ico">
        <meta property="og:image" content="https://example.com/og-logo.png">
      </head></html>
    `;
    expect(findLogoCandidate(html, "https://example.com")).toBe("https://example.com/og-logo.png");
  });

  it("matches og:image with attributes in reverse order", () => {
    const html = `<meta content="https://example.com/logo.png" property="og:image">`;
    expect(findLogoCandidate(html, "https://example.com")).toBe("https://example.com/logo.png");
  });

  it("falls back to apple-touch-icon when no og:image exists", () => {
    const html = `<link rel="apple-touch-icon" href="/touch-icon.png">`;
    expect(findLogoCandidate(html, "https://example.com/about")).toBe("https://example.com/touch-icon.png");
  });

  it("falls back to a plain favicon as a last resort", () => {
    const html = `<link rel="icon" href="/favicon.png">`;
    expect(findLogoCandidate(html, "https://example.com")).toBe("https://example.com/favicon.png");
  });

  it("resolves a relative URL against the page's own base", () => {
    const html = `<meta property="og:image" content="images/brand.png">`;
    expect(findLogoCandidate(html, "https://example.com/nested/page")).toBe(
      "https://example.com/nested/images/brand.png",
    );
  });

  it("returns null when nothing matches", () => {
    expect(findLogoCandidate("<html><body>No images here</body></html>", "https://example.com")).toBeNull();
  });
});
