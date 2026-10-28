import type { ReactNode } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

type LinkItem = { label: string; href: string };

/** Shared card for the 404 ("page not found") and 500 ("something went
 *  wrong") pages — same structure, different copy/illustration/actions.
 *  Lives inside `(candidate)/not-found.tsx` and `(candidate)/error.tsx`,
 *  which already provide the real site shell (TopNav/Rail/Footer) — this
 *  is just the content card itself, matching the two supplied designs. */
export function ErrorPageCard({
  eyebrow,
  code,
  headline,
  body,
  primaryAction,
  secondaryAction,
  links,
  illustrationSrc,
  illustrationAlt,
  chip,
}: {
  eyebrow: string;
  code: string;
  headline: string;
  body: string;
  /** A real `<Link>` when it's just navigation (404's CTAs), or a plain
   *  button when it needs to run client code first (500's "Try again"
   *  calls `reset()`) — both render identically via `buttonClassName`. */
  primaryAction: ReactNode;
  secondaryAction: ReactNode;
  links: LinkItem[];
  illustrationSrc: string;
  illustrationAlt: string;
  chip?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-8 sm:p-12">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-pine uppercase">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pine" aria-hidden="true" />
            {eyebrow}
          </div>

          <p className="mt-4 font-display text-6xl font-extrabold text-ink sm:text-7xl" aria-hidden="true">
            {code[0]}
            <span className="text-pine">{code[1]}</span>
            {code.slice(2)}
          </p>

          <h1 className="mt-4 font-display text-2xl font-bold text-ink sm:text-3xl">{headline}</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{body}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            {primaryAction}
            {secondaryAction}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="font-medium text-pine hover:underline">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-[280px] shrink-0 sm:w-[320px]">
          <div className="relative aspect-square rounded-full bg-pine/10">
            <span className="absolute top-6 right-4 h-2.5 w-2.5 rounded-full bg-pine/40" aria-hidden="true" />
            <span className="absolute bottom-10 left-2 h-2 w-2 rounded-full bg-pine/30" aria-hidden="true" />
            <Image
              src={illustrationSrc}
              alt={illustrationAlt}
              fill
              sizes="(min-width: 640px) 320px, 280px"
              className="object-contain p-6"
              priority
            />
          </div>
          {chip && (
            <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap text-ink shadow-sm sm:left-auto sm:right-0 sm:translate-x-0">
              <svg className="h-3.5 w-3.5 shrink-0 text-pine" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
              {chip}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
