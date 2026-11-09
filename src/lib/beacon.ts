/** Shared by every "fire and forget, never block the page" client-side
 *  tracking call (job views, apply-button clicks): `sendBeacon` survives
 *  an immediate navigation away, falling back to a keepalive `fetch` in
 *  the rare case it's unavailable. A missed count is never worth
 *  breaking the UI over, so this never throws. */
export function sendBeacon(url: string) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url);
    } else {
      fetch(url, { method: "POST", keepalive: true });
    }
  } catch {
    // never worth breaking the page over
  }
}
