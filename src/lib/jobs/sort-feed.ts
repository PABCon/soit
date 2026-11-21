/** A minimal, self-contained interface — deliberately NOT importing
 *  `JobRow` from `@/lib/db/jobs`, even just as a type. That file pulls in
 *  side-effecting runtime imports (the Resend client gets constructed at
 *  module load, via `messaging.ts` → `send.ts`), so importing anything
 *  from it at all — type-only or not, since TS path imports still load
 *  the real module at test time — breaks under Vitest with no API key
 *  configured. `sortForFeed` only ever reads these three fields, so this
 *  is the full contract it needs. */
export type FeedSortableJob = {
  companies: { top_employer_active: boolean };
  salary_public: boolean;
  boost_rank_at: string | null;
};

/**
 * Growth-phase override (2026-11-17, direct request): Top-Employer-first
 * placement (plus its salary-visible tiebreak) is temporarily switched
 * off so the main feed surfaces whichever company posted most recently
 * instead of always the same handful of existing Top Employer accounts
 * — the explicit goal right now is showing off company variety while
 * actively growing that list, not the paid-placement promise. Flip this
 * back to `true` once there's enough Top Employer breadth that
 * always-first placement is worth re-enforcing again — that's the whole
 * point of this being a flag rather than deleted code.
 */
export const TOP_EMPLOYER_FIRST = false;

/** Feed ordering (§pricing): when `topEmployerFirst` is on, Top Employer
 *  first (the paid placement promise, never undermined by anything
 *  below it), then a standing structural preference for salary-
 *  transparent listings within whatever tier a job is already in — a
 *  permanent edge, unlike the existing one-time publish-moment salary-
 *  transparency auto-boost (which just sets `boost_rank_at` once and
 *  decays in relative ranking as newer jobs get posted/boosted after
 *  it). Only ever affects paying customers relative to each other:
 *  hiding salary is a paid-tier-only choice, so a free-tier job (the
 *  majority) always has `salary_public: true` already and is never
 *  disadvantaged by this. Either way, falls through to `boost_rank_at`
 *  descending — rows already arrive that way from the DB's own
 *  `order()` clause, so this only ever reorders across tier/visibility
 *  boundaries when `topEmployerFirst` is on. */
export function sortForFeed<T extends FeedSortableJob>(rows: T[], topEmployerFirst: boolean = TOP_EMPLOYER_FIRST): T[] {
  return [...rows].sort((a, b) => {
    if (topEmployerFirst) {
      const topEmployerDelta = Number(b.companies.top_employer_active) - Number(a.companies.top_employer_active);
      if (topEmployerDelta !== 0) return topEmployerDelta;

      const salaryVisibleDelta = Number(b.salary_public) - Number(a.salary_public);
      if (salaryVisibleDelta !== 0) return salaryVisibleDelta;
    }

    const aRank = a.boost_rank_at ? new Date(a.boost_rank_at).getTime() : 0;
    const bRank = b.boost_rank_at ? new Date(b.boost_rank_at).getTime() : 0;
    return bRank - aRank;
  });
}
