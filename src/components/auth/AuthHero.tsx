import type { LucideIcon } from "lucide-react";

type Bullet = { Icon: LucideIcon; title: string; desc: string };

/** The left-panel decorative content for the four auth pages (round 21) —
 *  brand lockup, a two-tone headline, a subtitle, and the real feature
 *  bullets for this role/mode. Purely presentational: no data fetching,
 *  no auth state. */
export function AuthHero({
  eyebrow,
  headlinePrefix,
  headlineEmphasis,
  subtitle,
  bullets,
  children,
}: {
  eyebrow?: string;
  headlinePrefix: string;
  headlineEmphasis: string;
  subtitle: string;
  bullets: Bullet[];
  /** Optional extra content below the bullets (round 21's trust-logo
   *  section, employer-register only) — kept generic here so this
   *  component doesn't need to know about company data. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- small local brand asset, not a remote/optimizable photo */}
        <img src="/android-chrome-192.png" alt="" className="h-10 w-10 rounded-xl" />
        {/* eslint-disable-next-line @next/next/no-img-element -- small local brand asset, not a remote/optimizable photo */}
        <img src="/logo-justit.png" alt="Just IT" className="h-6 w-auto" />
      </div>

      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold tracking-wide text-pine uppercase">{eyebrow}</p>}
        <h1 className="font-display text-4xl leading-tight font-bold text-ink">
          {headlinePrefix} <span className="text-pine">{headlineEmphasis}</span>
        </h1>
        <p className="mt-4 text-base text-muted">{subtitle}</p>
      </div>

      <ul className="flex flex-col gap-4 border-t border-line pt-6">
        {bullets.map(({ Icon, title, desc }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-ink">{title}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          </li>
        ))}
      </ul>

      {children}
    </div>
  );
}
