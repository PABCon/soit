"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export const PENDING_CV_REVIEW_TOKEN_KEY = "soit_pending_cv_review_token";

/**
 * Real bug, reported directly from testing: a score computed anonymously
 * only ever lived in CvReviewUpload's own React state — the explicit
 * `next=` link on its "create account"/"log in" CTAs correctly carries the
 * token through registration (already verified end-to-end), but a visitor
 * who instead used the site's main nav login/register — a completely
 * separate component with no idea a CV review was ever in progress — lost
 * it entirely on navigation.
 *
 * Fixed with the same localStorage-cross-navigation pattern
 * EngagementPopup already established for this exact kind of problem:
 * CvReviewUpload writes the pending token here the moment a score comes
 * back anonymous (unclaimed); this watcher, mounted once in the candidate
 * shell so it sees every page load, checks for a session and — if one now
 * exists and a token is still pending — clears the key and navigates
 * straight to the results page, regardless of how the visitor actually
 * got logged in. The explicit `next=` links stay as the fast, no-extra-
 * round-trip path for the direct-click case; this is the fallback that
 * makes the slower, indirect path correct too.
 */
export function CvReviewClaimWatcher() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const token = localStorage.getItem(PENDING_CV_REVIEW_TOKEN_KEY);
        if (!token) return;

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) return;

        localStorage.removeItem(PENDING_CV_REVIEW_TOKEN_KEY);
        router.push(`/avaliar-cv/resultado?token=${token}`);
      } catch {
        // Private browsing / blocked storage — never break the page over
        // a growth nudge, same convention as EngagementPopup.
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
