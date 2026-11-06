"use client";

import { useState } from "react";

/** Plain share-intent URLs — no SDK, no new dependency. Copy-link uses
 *  the clipboard API with a quiet failure (private browsing / blocked
 *  clipboard access shouldn't break the page over a share button). */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — nothing to recover, just stays unclicked.
    }
  }

  const iconClass = "flex h-9 w-9 items-center justify-center rounded-full bg-paper text-muted hover:bg-pine hover:text-white";

  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        title="LinkedIn"
        className={iconClass}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M6.5 8.5h3V18h-3V8.5Zm1.5-4a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4ZM11.5 8.5h2.9v1.3h.04c.4-.75 1.4-1.55 2.9-1.55 3.1 0 3.66 2 3.66 4.7V18h-3v-4.4c0-1.05-.02-2.4-1.46-2.4-1.47 0-1.7 1.15-1.7 2.33V18h-3V8.5Z" />
        </svg>
        <span className="sr-only">LinkedIn</span>
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noreferrer"
        title="X"
        className={iconClass}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M18.3 2H21l-6.4 7.3L22 22h-6.3l-5-6.5L4.9 22H2.2l6.9-7.9L2 2h6.4l4.5 6 5.4-6Zm-1.1 18h1.7L7.9 4H6.1l11.1 16Z" />
        </svg>
        <span className="sr-only">X</span>
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        title="Facebook"
        className={iconClass}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M13.5 21v-7.4h2.5l.4-2.9h-2.9V9c0-.84.23-1.4 1.44-1.4H16.5V5a19 19 0 0 0-2.07-.1c-2.05 0-3.46 1.25-3.46 3.55v2.25H8.5v2.9H11V21h2.5Z" />
        </svg>
        <span className="sr-only">Facebook</span>
      </a>
      <button type="button" onClick={handleCopy} title="Copy link" className={iconClass}>
        {copied ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
          </svg>
        )}
        <span className="sr-only">Copy link</span>
      </button>
    </div>
  );
}
