import { FileText } from "lucide-react";
import type { ThreadMessage } from "@/lib/db/messaging";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shared by both the console and candidate thread views. An image type
 *  gets an inline preview (clickable through to the full-size signed
 *  URL); anything else (pdf/docx) is a plain download link — a signed
 *  URL is enough, per the round's own "download link is enough" framing,
 *  the inline-preview case is the one true nice-to-have, kept cheap. */
export function MessageAttachment({
  attachment,
  tone,
}: {
  attachment: NonNullable<ThreadMessage["attachment"]>;
  tone: "own" | "other";
}) {
  const isImage = attachment.contentType.startsWith("image/");

  if (isImage) {
    return (
      <a href={attachment.signedUrl} target="_blank" rel="noreferrer" className="mt-1.5 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed storage URL, not a local/optimizable asset */}
        <img
          src={attachment.signedUrl}
          alt={attachment.filename}
          className="max-h-48 max-w-full rounded-lg border border-line/30 object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={attachment.signedUrl}
      target="_blank"
      rel="noreferrer"
      className={
        tone === "own"
          ? "mt-1.5 flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-2 text-sm hover:bg-white/20"
          : "mt-1.5 flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-sm hover:bg-subtle"
      }
    >
      <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-medium">{attachment.filename}</span>
      <span className={tone === "own" ? "shrink-0 text-xs text-white/70" : "shrink-0 text-xs text-muted"}>
        {formatBytes(attachment.sizeBytes)}
      </span>
    </a>
  );
}
