"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Search, Briefcase, ListFilter, ArrowUpDown, ChevronDown, User, Info } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { updateStatusAction, openApplicantThreadAction } from "@/app/[locale]/(console)/recruit/jobs/[id]/applicants/actions";
import { buttonClassName } from "@/components/Button";
import { Badge, type BadgeVariant } from "@/components/Badge";
import { Dropdown } from "@/components/Dropdown";
import type { CompanyApplicant, MyApplication } from "@/lib/db/applications";

type Status = MyApplication["status"];
const STATUSES: Status[] = ["applied", "viewed", "responded", "rejected", "closed"];
const STATUS_BADGE: Record<Status, BadgeVariant> = {
  applied: "info",
  viewed: "pending",
  responded: "positive",
  rejected: "negative",
  closed: "neutral",
};

type Sort = "newest" | "oldest";

/** The toolbar's three selects (job/status/sort) all share this exact
 *  leading-icon + appearance-none + trailing-chevron recipe — the same
 *  one `ConsoleJobsExplorer`/`JobsExplorer` already established for every
 *  other filter select in this app. */
function FilterSelect({
  icon,
  value,
  onChange,
  children,
}: {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex h-11 shrink-0 items-center">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 shrink-0 appearance-none rounded-lg border border-line bg-white py-0 pr-8 pl-9 text-sm font-medium text-ink transition-colors hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-pine"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </span>
  );
}

/** Bug fix: "Message" navigates straight to the real thread page instead
 *  of opening a small inline compose box — no message is sent at this
 *  point, so the pending label says "Opening…", not "Sending…" (a
 *  separate bug: the label previously borrowed `sending`, which is
 *  accurate for `ThreadComposer`'s own button on the thread page, not
 *  for this find-or-create-then-navigate action). */
function MessageButton({ applicationId }: { applicationId: string }) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await openApplicantThreadAction(applicationId);
          if (result.ok) router.push(`/recruit/messages/${result.threadId}`);
        })
      }
      className={buttonClassName()}
    >
      {pending ? t("opening") : t("message")}
    </button>
  );
}

/** Bug fix: the status badge IS the editable control now — clicking it
 *  opens a portal-rendered `Dropdown` (immune to the table wrapper's
 *  `overflow-x-auto` clipping the old absolute-positioned panel) instead
 *  of a separate `<select>` living in Actions, which left two different
 *  status displays on the same row. `onChange` updates the parent's
 *  optimistic state immediately; `updateStatusAction` persists in the
 *  background, same fire-and-forget pattern the old inline `<select>`
 *  already used here. */
function StatusDropdown({
  jobId,
  applicationId,
  status,
  onChange,
}: {
  jobId: string;
  applicationId: string;
  status: Status;
  onChange: (status: Status) => void;
}) {
  const t = useTranslations("applicants");

  function select(next: Status, close: () => void) {
    onChange(next);
    close();
    if (next !== status) updateStatusAction(jobId, applicationId, next);
  }

  return (
    <Dropdown
      portal
      trigger={
        <span className="inline-flex items-center gap-1">
          <Badge variant={STATUS_BADGE[status]}>{t(`status.${status}`)}</Badge>
          <ChevronDown className="h-3 w-3 text-muted" aria-hidden="true" />
        </span>
      }
      triggerLabel={t("changeStatus")}
      triggerClassName="inline-flex items-center rounded-full hover:opacity-80"
      align="left"
      panelClassName="w-40 rounded-lg border border-line bg-white py-1 shadow-md"
    >
      {(close) => (
        <>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => select(s, close)}
              className={
                s === status
                  ? "block w-full px-3 py-1.5 text-left text-sm font-medium text-pine"
                  : "block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-paper"
              }
            >
              {t(`status.${s}`)}
            </button>
          ))}
        </>
      )}
    </Dropdown>
  );
}

/** Item 2 (§7.2 review) — applicants across every one of the employer's
 *  jobs, not just one at a time. Restyled against the Applicant Management
 *  Dashboard reference: a search+filter+sort toolbar (client-side, same
 *  "filter the already-fetched array" pattern `ConsoleJobsExplorer`
 *  already uses — no new query) above a real table, same functionality
 *  this list already had (view CV, message, change status). */
export function AllApplicantsList({ applicants, locale }: { applicants: CompanyApplicant[]; locale: string }) {
  const t = useTranslations("applicants");

  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  // Optimistic status overrides — the server action's own revalidatePath
  // targets the per-job applicants page, not this aggregated one, so a
  // status change needs to update this list's own display immediately
  // rather than waiting on a reload that was never coming.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Status>>({});

  const effectiveApplicants = useMemo(
    () => applicants.map((a) => (statusOverrides[a.id] ? { ...a, status: statusOverrides[a.id] } : a)),
    [applicants, statusOverrides],
  );

  const jobs = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of effectiveApplicants) map.set(a.jobId, a.jobTitle);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [effectiveApplicants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = effectiveApplicants.filter((a) => {
      if (q && !a.candidateName.toLowerCase().includes(q) && !a.jobTitle.toLowerCase().includes(q)) return false;
      if (jobFilter && a.jobId !== jobFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
    result.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "oldest" ? diff : -diff;
    });
    return result;
  }, [effectiveApplicants, query, jobFilter, statusFilter, sort]);

  if (applicants.length === 0) {
    return <p className="mt-8 text-sm text-muted">{t("empty")}</p>;
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-11 w-full min-w-0 rounded-lg border border-line bg-white pr-4 pl-9 text-sm placeholder:text-muted"
          />
        </div>

        <FilterSelect icon={<Briefcase className="h-4 w-4" aria-hidden="true" />} value={jobFilter} onChange={setJobFilter}>
          <option value="">{t("allJobs")}</option>
          {jobs.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect icon={<ListFilter className="h-4 w-4" aria-hidden="true" />} value={statusFilter} onChange={setStatusFilter}>
          <option value="">{t("allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect icon={<ArrowUpDown className="h-4 w-4" aria-hidden="true" />} value={sort} onChange={(v) => setSort(v as Sort)}>
          <option value="newest">{t("sortNewest")}</option>
          <option value="oldest">{t("sortOldest")}</option>
        </FilterSelect>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("noResults")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <th className="px-4 py-3">{t("columnCandidate")}</th>
                <th className="px-4 py-3">{t("columnJob")}</th>
                <th className="px-4 py-3">{t("columnApplied")}</th>
                <th className="px-4 py-3">{t("columnStatus")}</th>
                <th className="px-4 py-3">{t("columnActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const initial = a.candidateName.trim().charAt(0).toUpperCase() || null;
                return (
                  <tr key={a.id} className="border-b border-line last:border-0 align-top">
                    <td className="max-w-xs px-4 py-3">
                      <div className="flex items-start gap-3">
                        {a.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                          <img src={a.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine/10 text-sm font-semibold text-pine">
                            {initial ?? <User className="h-4 w-4" aria-hidden="true" />}
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link href={`/recruit/applicants/${a.id}`} className="font-medium text-ink hover:text-pine hover:underline">
                            {a.candidateName}
                          </Link>
                          <p className="truncate text-xs text-muted">{t("appliedFor", { job: a.jobTitle })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink">{a.jobTitle}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink">
                      {new Date(a.createdAt).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusDropdown
                        jobId={a.jobId}
                        applicationId={a.id}
                        status={a.status}
                        onChange={(s) => setStatusOverrides((o) => ({ ...o, [a.id]: s }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {a.cvSignedUrl ? (
                          <a href={a.cvSignedUrl} target="_blank" rel="noreferrer" className={buttonClassName({ variant: "secondary" })}>
                            {t("viewCv")}
                          </a>
                        ) : (
                          <span className="text-xs text-muted">{t("cvUnavailable")}</span>
                        )}
                        <MessageButton applicationId={a.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t("infoLine")}
      </p>
    </>
  );
}
