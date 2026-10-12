import { getTranslations } from "next-intl/server";
import { Briefcase, Users, UserPlus, Mail, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { EmployerDashboardStats } from "@/lib/db/jobs";

/** Console dashboard home (real-usage QA item) — a quick-glance summary
 *  above the job list, the thing `/recruit` never had: how many jobs are
 *  actually live, how many people have applied, and whether anything
 *  needs a reply. Each card links to where that number is explained in
 *  full, not just a static tile.
 *
 *  Round 22: icon-badge-square + trailing chevron treatment, matching
 *  the reference design — restyle only, same four real stats/links. */
export async function DashboardStats({ stats, locale }: { stats: EmployerDashboardStats; locale: string }) {
  const t = await getTranslations({ locale, namespace: "console" });
  const cards = [
    { key: "activeJobs", value: stats.activeJobs, href: "/recruit", Icon: Briefcase },
    { key: "totalApplicants", value: stats.totalApplicants, href: "/recruit/applicants", Icon: Users },
    { key: "newApplicantsLast7Days", value: stats.newApplicantsLast7Days, href: "/recruit/applicants", Icon: UserPlus },
    { key: "unreadMessages", value: stats.unreadMessages, href: "/recruit/messages", Icon: Mail },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 transition-colors hover:border-pine/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
            <card.Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-bold text-ink">{card.value}</p>
            <p className="truncate text-xs text-muted">{t(`dashboardStat.${card.key}`)}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
