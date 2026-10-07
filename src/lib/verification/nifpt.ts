import type { NifLookupResult, NifRegistryProvider } from "./types";

/**
 * nif.pt — a commercial Portuguese business-registry lookup (§5.7.6's
 * "layer 3", added because VIES misses are real: VIES only covers
 * entities enrolled for intra-EU VAT, so a real domestic-only Portuguese
 * company legitimately comes back not_found there). Used only as a
 * fallback when VIES itself doesn't resolve to `found` — see
 * `verify-company.ts`.
 *
 * API docs: https://www.nif.pt/api/ — GET with the key as a query
 * param (no header auth option). Server-side only; never exposed to
 * the client.
 */
const ENDPOINT = "https://www.nif.pt/";
const TIMEOUT_MS = 10_000;

type NifPtRecord = {
  nif: number | string;
  title?: string;
};

type NifPtResponse = {
  result?: string;
  message?: string;
  is_nif?: boolean;
  records?: Record<string, NifPtRecord>;
};

export class NifPtProvider implements NifRegistryProvider {
  async lookup(nif: string): Promise<NifLookupResult> {
    const apiKey = process.env.NIF_PT_API_KEY;
    if (!apiKey) return { outcome: "undetermined", source: "provider" };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const url = new URL(ENDPOINT);
      url.searchParams.set("json", "1");
      url.searchParams.set("q", nif);
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) return { outcome: "undetermined", source: "provider" };

      const data = (await res.json()) as NifPtResponse;

      if (data.result === "success") {
        const record = data.records?.[nif];
        if (record) {
          return {
            outcome: "found",
            legalName: record.title || undefined,
            reference: String(record.nif),
            source: "provider",
          };
        }
        // Shouldn't happen alongside result:"success" per observed
        // behavior, but a missing record is not_found either way.
        return { outcome: "not_found", source: "provider" };
      }

      // `result !== "success"` genuinely means two different things here,
      // confirmed against the live API (not assumed from the docs):
      // a syntactically valid-looking NIF with no matching business comes
      // back `{"result":"error","message":"No records found",
      // "is_nif":true}` — a real, decisive not_found. A rate limit or key
      // problem comes back `{"result":"error","message":"Limit per
      // minute reached...","is_nif":false}` — not evidence about the NIF
      // at all. `is_nif` alone can't disambiguate these (it was `true` in
      // the first case and `false` in the second, but the second case's
      // `is_nif:false` is just a side effect of the error, not a real
      // validation verdict) — only the message text actually tells them
      // apart.
      if ((data.message ?? "").toLowerCase().includes("no records found")) {
        return { outcome: "not_found", source: "provider" };
      }
      return { outcome: "undetermined", source: "provider" };
    } catch {
      // Network error, abort, or malformed JSON — the service is
      // unreachable/unusable right now, not evidence the NIF is invalid.
      return { outcome: "undetermined", source: "provider" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
