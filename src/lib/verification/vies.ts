import type { NifLookupResult, NifRegistryProvider } from "./types";

/**
 * VIES (EU VAT Information Exchange System) — spec §5.7.1, §5.7.6.
 *
 * Uses the plain `checkVat` operation, not `checkVatApprox`: the latter
 * needs a requester VAT number to authenticate the query, which SóIT
 * doesn't have yet (no NIF of its own). `checkVat` needs no requester and
 * still gives a real found/not_found result plus the registered name where
 * the member state returns one. Swapping to `checkVatApprox` for the
 * consultation-number reference (§5.7.3) is a small change to this file
 * once SóIT registers.
 *
 * The caveat that decides the architecture (§5.7.1): VIES only covers
 * entities enrolled for intra-EU operations, so a real domestic-only
 * Portuguese company can come back `not_found`. It is also genuinely
 * flaky — it proxies each member state's national system — so any fault,
 * timeout or network error maps to `undetermined`, never `not_found`.
 */
const ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";
const TIMEOUT_MS = 10_000;

function envelope(countryCode: string, vatNumber: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${countryCode}</urn:countryCode>
      <urn:vatNumber>${vatNumber}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`));
  return match?.[1]?.trim();
}

export class ViesProvider implements NifRegistryProvider {
  async lookup(nif: string): Promise<NifLookupResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8" },
        body: envelope("PT", nif),
        signal: controller.signal,
      });
      const xml = await res.text();

      if (xml.includes("<soap:Fault>") || xml.includes("<soapenv:Fault>") || !res.ok) {
        // MS_UNAVAILABLE, SERVICE_UNAVAILABLE, TIMEOUT, GLOBAL_MAX_CONCURRENT_REQ,
        // MS_MAX_CONCURRENT_REQ, INVALID_INPUT — none of these mean "not a
        // business", so none of them may resolve to not_found.
        return { outcome: "undetermined", source: "vies" };
      }

      const valid = extractTag(xml, "valid") === "true";
      if (!valid) return { outcome: "not_found", source: "vies" };

      const name = extractTag(xml, "name");
      return {
        outcome: "found",
        legalName: name && name !== "---" ? name : undefined,
        source: "vies",
      };
    } catch {
      // Network error or abort — the service is unreachable, not the NIF invalid.
      return { outcome: "undetermined", source: "vies" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
