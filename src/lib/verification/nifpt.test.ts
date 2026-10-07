import { afterEach, describe, expect, it, vi } from "vitest";
import { NifPtProvider } from "./nifpt";

const ORIGINAL_ENV = process.env.NIF_PT_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_ENV === undefined) delete process.env.NIF_PT_API_KEY;
  else process.env.NIF_PT_API_KEY = ORIGINAL_ENV;
});

function mockFetchOnce(response: { ok: boolean; json?: () => Promise<unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: response.ok, json: response.json ?? (() => Promise.resolve({})) }),
  );
}

describe("NifPtProvider — found", () => {
  it("resolves found with the registered legal name when a record is returned", async () => {
    process.env.NIF_PT_API_KEY = "test-key";
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          result: "success",
          is_nif: true,
          records: { "509442013": { nif: 509442013, title: "Nexperience Lda" } },
        }),
    });

    const result = await new NifPtProvider().lookup("509442013");
    expect(result).toEqual({
      outcome: "found",
      legalName: "Nexperience Lda",
      reference: "509442013",
      source: "provider",
    });
  });

  it("passes through address/city when the registry record has them", async () => {
    process.env.NIF_PT_API_KEY = "test-key";
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          result: "success",
          is_nif: true,
          records: {
            "980722330": {
              nif: 980722330,
              title: "Itds Polska Sp. Z.o.o",
              address: "Largo do Duque de Cadaval, 17",
              city: "Lisboa",
            },
          },
        }),
    });

    const result = await new NifPtProvider().lookup("980722330");
    expect(result.address).toBe("Largo do Duque de Cadaval, 17");
    expect(result.city).toBe("Lisboa");
  });
});

describe("NifPtProvider — not_found", () => {
  // Real, observed API response for a syntactically NIF-shaped number with
  // no matching business — confirmed live against the real endpoint before
  // writing this test, not assumed from the docs:
  // {"result":"error","message":"No records found","is_nif":true}
  it("resolves not_found when the API reports 'No records found'", async () => {
    process.env.NIF_PT_API_KEY = "test-key";
    mockFetchOnce({
      ok: true,
      json: () => Promise.resolve({ result: "error", message: "No records found", is_nif: true }),
    });

    const result = await new NifPtProvider().lookup("999999990");
    expect(result).toEqual({ outcome: "not_found", source: "provider" });
  });

  it("resolves not_found when no record is returned for the NIF despite a successful call", async () => {
    process.env.NIF_PT_API_KEY = "test-key";
    mockFetchOnce({ ok: true, json: () => Promise.resolve({ result: "success", is_nif: true, records: {} }) });

    const result = await new NifPtProvider().lookup("509442013");
    expect(result).toEqual({ outcome: "not_found", source: "provider" });
  });
});

describe("NifPtProvider — undetermined (never blocks on a provider hiccup)", () => {
  it("resolves undetermined on a network error", async () => {
    process.env.NIF_PT_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await new NifPtProvider().lookup("509442013");
    expect(result).toEqual({ outcome: "undetermined", source: "provider" });
  });

  it("resolves undetermined on a non-ok HTTP response", async () => {
    process.env.NIF_PT_API_KEY = "test-key";
    mockFetchOnce({ ok: false });

    const result = await new NifPtProvider().lookup("509442013");
    expect(result).toEqual({ outcome: "undetermined", source: "provider" });
  });

  // Real, observed response for a rate-limit error — note is_nif is also
  // `false` here, same as a real not_found could look at a glance, which
  // is exactly why the provider must key off `message`, not `is_nif`,
  // to tell these apart:
  // {"result":"error","message":"Limit per minute reached...","is_nif":false}
  it("resolves undetermined on a rate-limit error, not not_found", async () => {
    process.env.NIF_PT_API_KEY = "test-key";
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          result: "error",
          message: "Limit per minute reached. Please, try again later or buy credits.",
          is_nif: false,
        }),
    });

    const result = await new NifPtProvider().lookup("509442013");
    expect(result).toEqual({ outcome: "undetermined", source: "provider" });
  });

  it("resolves undetermined when the API reports failure with no recognizable message", async () => {
    process.env.NIF_PT_API_KEY = "test-key";
    mockFetchOnce({ ok: true, json: () => Promise.resolve({ result: "error" }) });

    const result = await new NifPtProvider().lookup("509442013");
    expect(result).toEqual({ outcome: "undetermined", source: "provider" });
  });

  it("resolves undetermined when no API key is configured, without ever calling fetch", async () => {
    delete process.env.NIF_PT_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await new NifPtProvider().lookup("509442013");
    expect(result).toEqual({ outcome: "undetermined", source: "provider" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
