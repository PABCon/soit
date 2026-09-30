"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function ThreadReplyBox({ onSend }: { onSend: (body: string) => Promise<{ ok: boolean }> }) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await onSend(body);
      if (result.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("messagePlaceholder")}
        rows={3}
        className="w-full rounded-lg border border-line p-2 text-sm"
      />
      <button
        type="button"
        disabled={pending || !body.trim()}
        onClick={submit}
        className="mt-2 h-9 rounded-lg bg-pine px-4 text-sm font-semibold text-white hover:bg-pine/90 disabled:opacity-50"
      >
        {pending ? t("sending") : t("send")}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
