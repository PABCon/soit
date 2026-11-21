"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Dropdown } from "@/components/Dropdown";
import { MVP } from "@/components/console/Sidebar";

const itemClass = "flex items-center gap-3 px-3 py-2 text-sm text-ink hover:bg-paper";

/**
 * Mobile-only console navigation (md:hidden) — same hamburger pattern as
 * the candidate side's MobileNavMenu, replacing Sidebar's old horizontal-
 * scroll tab strip below md (real-device report: no visible cue more
 * tabs sat off-screen, the last one cut mid-label at the viewport edge).
 * Reuses Sidebar's own MVP list so the two can't drift apart.
 */
export function MobileConsoleMenu({ unreadMessageCount = 0 }: { unreadMessageCount?: number }) {
  const t = useTranslations("console");

  return (
    <Dropdown
      triggerClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-white md:hidden"
      triggerLabel={t("myJobAds")}
      align="auto"
      panelClassName="w-64 max-h-[70dvh] overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-sm"
      trigger={<Menu className="h-5 w-5" aria-hidden="true" />}
    >
      {(close) => (
        <>
          {MVP.map(({ key, href, Icon }) => (
            <Link key={key} href={href} className={itemClass} onClick={close}>
              <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              {t(key)}
              {key === "messages" && unreadMessageCount > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-pine px-1 text-[11px] font-semibold text-white">
                  {unreadMessageCount}
                </span>
              )}
            </Link>
          ))}
        </>
      )}
    </Dropdown>
  );
}
