import { describe, expect, it } from "vitest";
import { findLogoCandidate, findSocialLinks, extractHomepageLinks, pickCandidatePages } from "./extract-company-profile";

/** `findAboutPageUrl`'s old single-category tests, rewritten against the
 *  two functions that replaced it when the crawl widened from one About
 *  page to About/Careers/Benefits/Contact. */
function pickOne(html: string, baseUrl: string) {
  const links = extractHomepageLinks(html, baseUrl);
  return pickCandidatePages(links, baseUrl);
}

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

describe("extractHomepageLinks + pickCandidatePages (replaces the old single-category findAboutPageUrl)", () => {
  it("finds a same-site about page by href", () => {
    const html = `<a href="/about-us">Learn more</a>`;
    expect(pickOne(html, "https://example.com")).toEqual([{ url: "https://example.com/about-us", labels: ["about"] }]);
  });

  it("finds a same-site about page by visible link text", () => {
    const html = `<a href="/who-we-are">About <strong>Us</strong></a>`;
    expect(pickOne(html, "https://example.com")).toEqual([{ url: "https://example.com/who-we-are", labels: ["about"] }]);
  });

  it("never follows an off-site link", () => {
    const html = `<a href="https://other-site.com/about">About</a>`;
    expect(pickOne(html, "https://example.com")).toEqual([]);
  });

  it("never returns the homepage itself", () => {
    const html = `<a href="/">About</a>`;
    expect(pickOne(html, "https://example.com")).toEqual([]);
  });

  it("returns nothing when no page matches any category", () => {
    const html = `<a href="/products">Products</a><a href="/pricing">Pricing</a>`;
    expect(pickOne(html, "https://example.com")).toEqual([]);
  });

  it("finds a careers page distinct from an about page", () => {
    const html = `<a href="/about">About</a><a href="/careers">Careers</a>`;
    expect(pickOne(html, "https://example.com")).toEqual([
      { url: "https://example.com/about", labels: ["about"] },
      { url: "https://example.com/careers", labels: ["careers"] },
    ]);
  });

  it("finds benefits and contact pages too", () => {
    const html = `<a href="/perks">Our benefits</a><a href="/contacto">Contacto</a>`;
    expect(pickOne(html, "https://example.com")).toEqual([
      { url: "https://example.com/perks", labels: ["benefits"] },
      { url: "https://example.com/contacto", labels: ["contact"] },
    ]);
  });

  it("labels one page under both categories when it matches two (e.g. a combined About & Careers page)", () => {
    const html = `<a href="/join-us">About &amp; careers</a>`;
    expect(pickOne(html, "https://example.com")).toEqual([
      { url: "https://example.com/join-us", labels: ["about", "careers"] },
    ]);
  });
});
