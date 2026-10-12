"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Share2, Check } from "lucide-react";

/** Round-15 job detail page — a genuinely functional "Share" action (copy
 *  the current page URL), not a decorative button that silently does
 *  nothing. No native share-sheet dependency: clipboard copy works
 *  everywhere and matches the "copy a link" pattern the team-invite flow
 *  already established elsewhere in this app. */
export function ShareButton({ className = "" }: { className?: string }) {
  const t = useTranslations("job");
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — not
      // worth surfacing an error for a non-critical convenience action.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm text-muted hover:text-pine ${className}`}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      {copied ? t("linkCopied") : t("share")}
    </button>
  );
}
