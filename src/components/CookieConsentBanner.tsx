"use client";

import { useSyncExternalStore } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/Button";

const CONSENT_KEY = "soit_cookie_consent";
const CONSENT_EVENT = "soit:cookie-consent-change";
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

type Consent = "pending" | "accepted" | "rejected";

// `useSyncExternalStore`, not `useState`+`useEffect` — reading localStorage
// then `setState`-ing it inside an effect is exactly the cascading-render
// pattern `react-hooks/set-state-in-effect` flags (same lint rule this
// project already hit once for Rail's old collapse state). `getServerSnapshot`
// returns `null` (render nothing) so the server-rendered markup never
// claims a choice that hasn't actually been read from the browser yet.
function getSnapshot(): Consent {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored === "accepted" || stored === "rejected" ? stored : "pending";
  } catch {
    return "pending"; // private browsing / storage blocked — still show the banner
  }
}
function getServerSnapshot(): Consent | null {
  return null;
}
function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  return () => window.removeEventListener(CONSENT_EVENT, callback);
}

function setConsent(value: "accepted" | "rejected") {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // ignore — private browsing / storage blocked
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/**
 * Google Analytics (GA4) is not strictly necessary (§4 of the Privacy
 * Policy), so under Art. 5(3) of the ePrivacy Directive it needs real prior
 * consent — `gtag.js` must never load before the visitor accepts. Mounted
 * once in the root `[locale]/layout.tsx` (the only layout wrapping every
 * route group), same reasoning as the Footer/Rail's own "mount once at the
 * top, never per route-group" precedent.
 */
export function CookieConsentBanner() {
  const t = useTranslations("cookieConsent");
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!GA_ID) return null; // nothing to consent to if analytics isn't configured

  return (
    <>
      {consent === "accepted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}

      {consent === "pending" && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white px-4 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {t("message")}{" "}
              <Link href="/privacy" className="text-pine hover:underline">
                {t("privacyLinkText")}
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="md" onClick={() => setConsent("rejected")}>
                {t("reject")}
              </Button>
              <Button variant="primary" size="md" onClick={() => setConsent("accepted")}>
                {t("accept")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
