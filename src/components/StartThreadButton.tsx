"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/** Shared compose-then-navigate action for both messaging entry points
 *  (an applicant row, a blinded match card) — neither needs to know
 *  about the other's origin, just how to start its own thread. */
export function StartThreadButton({
  onSend,
  redirectBase,
  triggerClassName = "shrink-0 text-sm font-medium text-pine hover:underline",
  triggerLabel,
  placeholder,
  submitLabel,
}: {
  onSend: (body: string) => Promise<{ ok: boolean; threadId?: string }>;
  redirectBase: string;
  /** Defaults to the original link-style trigger — other callers
   *  (`ApplicantsList`, the matchmaking candidate page) are unaffected;
   *  `AllApplicantsList`'s table restyle passes the shared `Button` recipe
   *  instead, to match its real buttons. */
  triggerClassName?: string;
  /** Phase 3: the matchmaking candidate page frames this as a real
   *  connection request, not a plain message, so its trigger/placeholder/
   *  submit copy differ from the applicant-contact entry point. Each
   *  defaults to the original plain-message strings when omitted, so
   *  every other caller is unaffected. */
  triggerLabel?: string;
  placeholder?: string;
  submitLabel?: string;
}) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel ?? t("message")}
      </button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await onSend(body);
      if (result.ok && result.threadId) {
        router.push(`${redirectBase}/${result.threadId}`);
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  return (
    <div className="mt-2 w-full">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder ?? t("messagePlaceholder")}
        rows={2}
        className="w-full rounded-lg border border-line p-2 text-sm"
      />
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={submit}
          className="h-8 rounded-lg bg-pine px-3 text-xs font-semibold text-white hover:bg-pine/90 disabled:opacity-50"
        >
          {pending ? t("sending") : (submitLabel ?? t("send"))}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:underline">
          {t("cancel")}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
