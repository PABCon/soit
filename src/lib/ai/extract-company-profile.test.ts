import { describe, expect, it } from "vitest";
import { findLogoCandidate, findSocialLinks, findAboutPageUrl } from "./extract-company-profile";

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

describe("findSocialLinks", () => {
  it("finds real company profile links in the footer", () => {
    const html = `
      <footer>
        <a href="https://www.facebook.com/mycompany">FB</a>
        <a href="https://www.linkedin.com/company/mycompany">LI</a>
        <a href="https://www.instagram.com/mycompany/">IG</a>
        <a href="https://www.youtube.com/@mycompany">YT</a>
        <a href="https://www.tiktok.com/@mycompany">TT</a>
        <a href="https://x.com/mycompany">X</a>
      </footer>
    `;
    expect(findSocialLinks(html)).toEqual({
      facebookUrl: "https://www.facebook.com/mycompany",
      linkedinUrl: "https://www.linkedin.com/company/mycompany",
      instagramUrl: "https://www.instagram.com/mycompany/",
      youtubeUrl: "https://www.youtube.com/@mycompany",
      tiktokUrl: "https://www.tiktok.com/@mycompany",
      xUrl: "https://x.com/mycompany",
    });
  });

  it("ignores share-button links, not the company's own profile", () => {
    const html = `
      <a href="https://www.facebook.com/sharer/sharer.php?u=https://example.com">Share</a>
      <a href="https://twitter.com/intent/tweet?url=https://example.com">Tweet</a>
    `;
    expect(findSocialLinks(html)).toEqual({});
  });

  it("strips tracking query params off a matched link", () => {
    const html = `<a href="https://www.facebook.com/mycompany?ref=123&fbclid=abc">FB</a>`;
    expect(findSocialLinks(html).facebookUrl).toBe("https://www.facebook.com/mycompany");
  });

  it("does not mistake a personal LinkedIn profile for the company page", () => {
    const html = `<a href="https://www.linkedin.com/in/some-employee">LI</a>`;
    expect(findSocialLinks(html).linkedinUrl).toBeUndefined();
  });

  it("returns an empty object when nothing matches", () => {
    expect(findSocialLinks("<html><body>no links here</body></html>")).toEqual({});
  });

  it("matches a bare YouTube custom-slug URL, not just /channel//c//user//@ forms (real bug: vodafone.pt links youtube.com/vodafonept directly)", () => {
    const html = `<a href="https://www.youtube.com/vodafonept">YT</a>`;
    expect(findSocialLinks(html).youtubeUrl).toBe("https://www.youtube.com/vodafonept");
  });

  it("does not mistake a single-video YouTube link for a channel link", () => {
    const html = `<a href="https://www.youtube.com/watch?v=abc123">Watch our video</a>`;
    expect(findSocialLinks(html).youtubeUrl).toBeUndefined();
  });
});

describe("findAboutPageUrl", () => {
  it("finds a same-site about page by href", () => {
    const html = `<a href="/about-us">Learn more</a>`;
    expect(findAboutPageUrl(html, "https://example.com")).toBe("https://example.com/about-us");
  });

  it("finds a same-site about page by visible link text", () => {
    const html = `<a href="/who-we-are">About <strong>Us</strong></a>`;
    expect(findAboutPageUrl(html, "https://example.com")).toBe("https://example.com/who-we-are");
  });

  it("never follows an off-site link", () => {
    const html = `<a href="https://other-site.com/about">About</a>`;
    expect(findAboutPageUrl(html, "https://example.com")).toBeNull();
  });

  it("never returns the homepage itself", () => {
    const html = `<a href="/">About</a>`;
    expect(findAboutPageUrl(html, "https://example.com")).toBeNull();
  });

  it("returns null when no about-style link exists", () => {
    const html = `<a href="/products">Products</a><a href="/contact">Contact</a>`;
    expect(findAboutPageUrl(html, "https://example.com")).toBeNull();
  });
});
