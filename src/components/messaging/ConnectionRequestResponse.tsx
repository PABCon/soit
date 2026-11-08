"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Decision = "accepted" | "declined";
type RespondResult = { ok: true } | { ok: false; reason?: string };

/** Phase 3. The candidate's own real accept/decline gate: an employer's
 *  opening message on a 'match' thread is a genuine request, not an
 *  already-open conversation. Shown in place of `ThreadReplyBox` while
 *  `request_status === "pending"`; the candidate must click one of these
 *  two buttons before any reply box appears at all. */
export function ConnectionRequestResponse({
  companyName,
  onRespond,
}: {
  companyName: string;
  onRespond: (decision: Decision) => Promise<RespondResult>;
}) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function respond(decision: Decision) {
    setError(null);
    startTransition(async () => {
      const result = await onRespond(decision);
      if (result.ok) {
        router.refresh();
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-paper/60 p-4">
      <p className="text-sm text-ink">{t("respondPrompt", { company: companyName })}</p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => respond("accepted")}
          className="h-9 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine-hover disabled:opacity-50"
        >
          {t("accept")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => respond("declined")}
          className="h-9 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-white disabled:opacity-50"
        >
          {t("decline")}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
