import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { EmployerDashboardStats } from "@/lib/db/jobs";

/** Console dashboard home (real-usage QA item) — a quick-glance summary
 *  above the job list, the thing `/recruit` never had: how many jobs are
 *  actually live, how many people have applied, and whether anything
 *  needs a reply. Each card links to where that number is explained in
 *  full, not just a static tile. */
export async function DashboardStats({ stats, locale }: { stats: EmployerDashboardStats; locale: string }) {
  const t = await getTranslations({ locale, namespace: "console" });
  const cards = [
    { key: "activeJobs", value: stats.activeJobs, href: "/recruit" },
    { key: "totalApplicants", value: stats.totalApplicants, href: "/recruit/applicants" },
    { key: "newApplicantsLast7Days", value: stats.newApplicantsLast7Days, href: "/recruit/applicants" },
    { key: "unreadMessages", value: stats.unreadMessages, href: "/recruit/messages" },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          className="rounded-xl border border-line bg-white p-4 transition-colors hover:border-pine/40"
        >
          <p className="font-display text-2xl font-bold text-ink">{card.value}</p>
          <p className="mt-0.5 text-xs text-muted">{t(`dashboardStat.${card.key}`)}</p>
        </Link>
      ))}
    </div>
  );
}
