"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Round 31 — gained real attachment support, minimally: a plain paperclip
 *  button + hidden file input, same client-side size pre-check as the
 *  console's `ThreadComposer`, no other styling changes to this shared
 *  component (it's also the candidate-side reply box, out of round 30's
 *  console-only restyle scope — adding capability here isn't a styling
 *  change, so it stays in bounds). */
type SendResult = { ok: true } | { ok: false; reason?: string };

export function ThreadReplyBox({ onSend }: { onSend: (body: string, file: File | null) => Promise<SendResult> }) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (picked && picked.size > MAX_ATTACHMENT_BYTES) {
      setError(t("attachmentTooLarge"));
      e.target.value = "";
      return;
    }
    setError(null);
    setFile(picked);
  }

  function submit() {
    if (!body.trim() && !file) return;
    setError(null);
    startTransition(async () => {
      const result = await onSend(body, file);
      if (result.ok) {
        setBody("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } else {
        setError(result.reason === "bad_attachment" ? t("errorBadAttachment") : t("errorGeneric"));
      }
    });
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-paper px-2 py-1 text-xs text-ink">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            aria-label={t("removeAttachment")}
            className="shrink-0 text-muted hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("messagePlaceholder")}
        rows={3}
        className="w-full rounded-lg border border-line p-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("attachFile")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:text-pine"
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={pending || (!body.trim() && !file)}
          onClick={submit}
          className="h-9 rounded-lg bg-pine px-4 text-sm font-semibold text-white hover:bg-pine/90 disabled:opacity-50"
        >
          {pending ? t("sending") : t("send")}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
