"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Modal } from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";

const VIEWED_KEY = "soit_viewed_jobs";
const DISMISSED_KEY = "soit_engagement_popup_dismissed";
const VIEW_THRESHOLD = 3;

/**
 * A growth nudge, not a form-abandonment recovery (that was the original,
 * wrong framing — corrected to this): a signed-out visitor who's looked at
 * several different jobs this browser gets a one-time popup suggesting
 * they create an account to track applications. Tracked entirely
 * client-side (localStorage, per-browser) — no new table, no server
 * round-trip for the tracking itself.
 */
export function EngagementPopup({ jobSlug }: { jobSlug: string }) {
  const t = useTranslations("engagement");
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        if (localStorage.getItem(DISMISSED_KEY)) return;

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || user) return;

        const raw = localStorage.getItem(VIEWED_KEY);
        const viewed: string[] = raw ? JSON.parse(raw) : [];
        const next = [...new Set([...viewed, jobSlug])];
        localStorage.setItem(VIEWED_KEY, JSON.stringify(next));

        if (next.length >= VIEW_THRESHOLD && !cancelled) setShow(true);
      } catch {
        // Private browsing / storage blocked — never worth breaking the
        // page over a growth nudge.
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [jobSlug]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <Modal onClose={dismiss}>
      <div className="text-center">
        <h2 className="font-display text-lg font-bold text-ink">{t("title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("body")}</p>
        <Link
          href="/candidate/register"
          onClick={dismiss}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-pine text-sm font-semibold text-white hover:bg-pine/90"
        >
          {t("createAccount")}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="mt-3 text-sm text-muted underline underline-offset-2"
        >
          {t("maybeLater")}
        </button>
      </div>
    </Modal>
  );
}
