import { describe, expect, it } from "vitest";
import { normalizeWebsiteUrl } from "./url";

describe("normalizeWebsiteUrl", () => {
  it("adds https:// to a bare domain", () => {
    expect(normalizeWebsiteUrl("google.com")).toBe("https://google.com");
  });

  it("leaves an already-prefixed https:// URL unchanged", () => {
    expect(normalizeWebsiteUrl("https://example.com")).toBe("https://example.com");
  });

  it("leaves an already-prefixed http:// URL unchanged", () => {
    expect(normalizeWebsiteUrl("http://example.com")).toBe("http://example.com");
  });

  it("trims whitespace before checking/adding the protocol", () => {
    expect(normalizeWebsiteUrl("  example.com  ")).toBe("https://example.com");
  });

  it("returns null for null, undefined, or empty input", () => {
    expect(normalizeWebsiteUrl(null)).toBeNull();
    expect(normalizeWebsiteUrl(undefined)).toBeNull();
    expect(normalizeWebsiteUrl("")).toBeNull();
    expect(normalizeWebsiteUrl("   ")).toBeNull();
  });
});
