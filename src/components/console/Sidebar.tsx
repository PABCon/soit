"use client";

import { useTranslations } from "next-intl";
import { Briefcase, Users, Mail, Plug, DollarSign, User, Building2, Phone } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

const MVP = [
  { key: "myJobAds", href: "/recruit", Icon: Briefcase },
  { key: "matchmaking", href: "/recruit/matchmaking", Icon: Users },
  { key: "messages", href: "/recruit/messages", Icon: Mail },
  { key: "api", href: "/recruit/api", Icon: Plug },
  { key: "pricing", href: "/recruit/jobs/ads", Icon: DollarSign },
  { key: "applicants", href: "/recruit/applicants", Icon: User },
  { key: "companyProfile", href: "/recruit/company", Icon: Building2 },
  { key: "team", href: "/recruit/team", Icon: Users },
  { key: "myAccount", href: "/recruit/settings", Icon: User },
  { key: "contact", href: "/recruit/contact", Icon: Phone },
] as const;

/** Employer console sidebar (§7.2) — its own navigation, not the candidate
 *  rail. Identity (avatar) and locale live in `ConsoleTopNav` above this,
 *  not here — this is nav links only.
 *
 *  Round-10 full-fidelity sweep: this sidebar had zero active-route
 *  highlighting at all — a real, sitewide consistency gap per the
 *  standing instruction, since the candidate-side `Rail` has (now
 *  correctly) an active-state highlight for the exact same "which page
 *  am I on" nav role. Same recipe as `Rail.tsx`'s own fix this round —
 *  the reference's "Floating Side Menu" swatch's pale pine tint + pine
 *  text + left accent bar — applied here too rather than left on its
 *  prior, unhighlighted version.
 *
 *  Round 22: added a per-item icon (the reference design's own sidebar
 *  always pairs an icon with the label) — restyle only, same links/
 *  active-highlight logic unchanged. The long-standing disabled
 *  "My products" placeholder is dropped entirely per direct instruction,
 *  not kept as a placeholder — nothing in this app backs it. */
export function Sidebar({ unreadMessageCount = 0 }: { unreadMessageCount?: number }) {
  const t = useTranslations("console");
  const pathname = usePathname();

  // "/recruit" (My Job Ads) is a literal path-prefix of every other
  // console route (they're all nested under it), so a plain per-item
  // prefix match made it light up alongside whatever the real current
  // page was (e.g. both "My Job Ads" and "Pricing" active at once on
  // /recruit/jobs/ads) — caught live during this round's own
  // verification. Fixed generally rather than special-casing one href:
  // among every nav entry whose href actually matches the current
  // path, only the *longest* (most specific) one is active — this also
  // correctly keeps "My Job Ads" active on job edit/create sub-pages
  // (`/recruit/jobs/[id]/edit`, `/recruit/jobs/new`) that aren't in
  // this list at all, since "/recruit" is still the longest match there.
  const activeHref = MVP.map((m) => m.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  function isActive(href: string) {
    return href === activeHref;
  }

  return (
    <aside
      className={
        "flex w-full shrink-0 flex-col border-b border-line bg-white/60 px-3 py-4 " +
        // Sticky below ConsoleTopNav's own sticky h-14 header (same
        // "sticky top-<header height> + h-[calc(100dvh-<header height>)]"
        // recipe the candidate Rail already proved out) — only the
        // content to its right scrolls, matching the navbar never
        // scrolling itself.
        "md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:w-60 md:self-start md:overflow-y-auto md:border-r md:border-b-0"
      }
    >
      <nav className="flex gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
        {MVP.map(({ key, href, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={key}
              href={href}
              className={`relative flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-sm whitespace-nowrap ${
                active ? "bg-pine/10 font-medium text-pine" : "text-ink hover:bg-paper"
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -left-2 hidden h-5 w-[3px] -translate-y-1/2 rounded-r bg-pine md:block"
                />
              )}
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t(key)}
              {key === "messages" && unreadMessageCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pine px-1 text-[11px] font-semibold text-white">
                  {unreadMessageCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
