"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, Send, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { buttonClassName } from "@/components/Button";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Round 30 restyle of the employer-console thread composer — a separate
 *  component from the shared `ThreadReplyBox`, deliberately: this round
 *  is scoped to `/recruit/messages*` only, and `ThreadReplyBox` is also
 *  used by the candidate-side `/messages/[threadId]` page, which this
 *  round explicitly says not to touch. Same `onSend` contract either
 *  way.
 *
 *  Round 31 — the paperclip is a real file picker now (was purely
 *  decorative). A client-side size pre-check avoids an obviously-too-
 *  large upload ever leaving the browser; the real content-type check
 *  (magic bytes, never the extension) happens server-side in
 *  `sendMessage()`, same discipline as every other upload in this app. */
type SendResult = { ok: true } | { ok: false; reason?: string };

export function ThreadComposer({ onSend }: { onSend: (body: string, file: File | null) => Promise<SendResult> }) {
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
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-subtle px-3 py-1.5 text-sm text-ink">
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
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-2 pl-4">
        <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("attachFile")}
          className="shrink-0 text-muted hover:text-pine"
        >
          <Paperclip className="h-5 w-5" aria-hidden="true" />
        </button>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("messagePlaceholder")}
          className="h-10 min-w-0 flex-1 text-sm placeholder:text-muted focus:outline-none"
        />
        <button
          type="button"
          disabled={pending || (!body.trim() && !file)}
          onClick={submit}
          className={buttonClassName({ className: "shrink-0 gap-2" })}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {pending ? t("sending") : t("send")}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
