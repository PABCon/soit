import { describe, expect, it } from "vitest";
import { extractAnchors, resolveNextPageUrl } from "./extract-job-links";

describe("extractAnchors", () => {
  it("pulls visible text and an absolute url for each real anchor", () => {
    const html = `<a href="/jobs/1">Senior Engineer</a>`;
    expect(extractAnchors(html, "https://example.com")).toEqual([
      { text: "Senior Engineer", url: "https://example.com/jobs/1" },
    ]);
  });

  it("ignores anchors with no visible text", () => {
    const html = `<a href="/jobs/1"></a>`;
    expect(extractAnchors(html, "https://example.com")).toEqual([]);
  });

  it("ignores #, mailto:, tel: and javascript: links", () => {
    const html = `
      <a href="#top">Top</a>
      <a href="mailto:jobs@example.com">Email us</a>
      <a href="tel:+351000000000">Call us</a>
      <a href="javascript:void(0)">Do nothing</a>
    `;
    expect(extractAnchors(html, "https://example.com")).toEqual([]);
  });

  it("dedupes repeated links to the same url", () => {
    const html = `<a href="/jobs/1">Engineer</a><a href="/jobs/1">Apply now</a>`;
    expect(extractAnchors(html, "https://example.com")).toEqual([
      { text: "Engineer", url: "https://example.com/jobs/1" },
    ]);
  });

  it("resolves a relative href against the page's own base url", () => {
    const html = `<a href="jobs/2">Designer</a>`;
    expect(extractAnchors(html, "https://example.com/careers/")).toEqual([
      { text: "Designer", url: "https://example.com/careers/jobs/2" },
    ]);
  });
});

describe("resolveNextPageUrl", () => {
  const candidates = [
    { text: "Engineer", url: "https://example.com/jobs/1" },
    { text: "Next", url: "https://example.com/careers?page=2" },
  ];

  it("resolves a real, in-bounds next-page index to its url", () => {
    expect(resolveNextPageUrl(candidates, 1, "https://example.com/careers?page=1", new Set())).toBe(
      "https://example.com/careers?page=2",
    );
  });

  it("returns null when the model says there is no next page", () => {
    expect(resolveNextPageUrl(candidates, null, "https://example.com/careers?page=1", new Set())).toBeNull();
  });

  it("returns null for an out-of-bounds index rather than throwing", () => {
    expect(resolveNextPageUrl(candidates, 99, "https://example.com/careers?page=1", new Set())).toBeNull();
  });

  it("refuses a next page that's actually the current page (a self-linking pagination widget)", () => {
    expect(resolveNextPageUrl(candidates, 1, "https://example.com/careers?page=2", new Set())).toBeNull();
  });

  it("refuses a next page already visited earlier in this crawl (breaks a cycling pagination loop)", () => {
    const visited = new Set(["https://example.com/careers?page=2"]);
    expect(resolveNextPageUrl(candidates, 1, "https://example.com/careers?page=1", visited)).toBeNull();
  });
});
