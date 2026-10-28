import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF defense (security audit finding, 2026-10-28): every URL this app
 * fetches server-side on a user's behalf — job-link autofill, CV/company
 * extraction, the bulk importer, the suggested-logo fetch — originates
 * from untrusted input (an employer pasting a URL, or a page *that* URL
 * itself links to, like a discovered "next page" or job link). None of
 * these call sites validated the actual network destination before this:
 * only the URL *scheme* was checked, which does nothing to stop a request
 * aimed at `localhost`, an RFC1918 address, or a cloud metadata endpoint
 * (`169.254.169.254`) — a real, confirmed gap, not a theoretical one.
 *
 * This is the one place that validation now lives. `isPublicUrl` resolves
 * the hostname via DNS and rejects anything that isn't a genuine public
 * IP; `safeFetch` wraps `fetch` to apply that check on both the initial
 * URL and every redirect hop (the fetch itself is `redirect: "manual"` —
 * letting `fetch` auto-follow redirects would silently bypass this check
 * the moment a validated public URL 302s to an internal one).
 */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // malformed — fail closed
  const [a, b] = parts;
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0 && parts[2] === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved (224-255)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === "::1") return true; // loopback
  if (norm === "::") return true; // unspecified
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // unique local (fc00::/7)
  if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) {
    return true; // link-local (fe80::/10)
  }
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded IPv4 address too.
  const mapped = norm.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateIP(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP at all — fail closed
}

/** Resolves `hostname` and returns true only if every resolved address is
 *  a genuine public IP. Fails closed (returns false) on any DNS error —
 *  a hostname that doesn't resolve has nothing safe to fetch anyway. */
async function isPublicHostname(hostname: string): Promise<boolean> {
  const direct = isIP(hostname);
  if (direct) return !isPrivateIP(hostname);

  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    return records.every((r) => !isPrivateIP(r.address));
  } catch {
    return false;
  }
}

export type SafeFetchResult = { ok: true; response: Response } | { ok: false; reason: "invalid_url" | "private_address" | "too_many_redirects" | "fetch_failed" };

const MAX_REDIRECTS = 5;

/** `fetch()` wrapper that re-validates the destination (scheme + DNS
 *  resolution against private/reserved ranges) before every request,
 *  including each hop of a redirect chain. Never passes `redirect:
 *  "follow"` to the real `fetch` — that would validate only the URL the
 *  caller supplied and then let the runtime silently follow it anywhere. */
export async function safeFetch(url: string, init?: RequestInit): Promise<SafeFetchResult> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      return { ok: false, reason: "invalid_url" };
    }
    if (!(await isPublicHostname(current.hostname))) {
      return { ok: false, reason: "private_address" };
    }

    let res: Response;
    try {
      res = await fetch(current.toString(), { ...init, redirect: "manual" });
    } catch {
      return { ok: false, reason: "fetch_failed" };
    }

    // A manual-redirect fetch returns an opaqueredirect-ish 3xx with a
    // Location header instead of following it — resolve + re-validate
    // the next hop ourselves rather than trusting it blindly.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { ok: false, reason: "fetch_failed" };
      if (hop === MAX_REDIRECTS) return { ok: false, reason: "too_many_redirects" };
      try {
        current = new URL(location, current);
      } catch {
        return { ok: false, reason: "invalid_url" };
      }
      continue;
    }

    return { ok: true, response: res };
  }

  return { ok: false, reason: "too_many_redirects" };
}
