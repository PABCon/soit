"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Dropdown } from "@/components/Dropdown";
import { ITEMS } from "@/components/candidate/Rail";

const itemClass = "flex items-center gap-3 px-3 py-2 text-sm text-ink hover:bg-paper";

/**
 * Mobile-only site navigation (sm:hidden) — Rail, the desktop left nav,
 * is `hidden sm:block`, and nothing replaced it below that breakpoint: a
 * real-usage report found an anonymous mobile visitor had no way at all
 * to reach Companies/Blog/the salary calculator/etc, only the logo
 * (-> /jobs) and the login dropdown (candidate/employer auth only, no
 * site navigation of its own). Mirrors Rail's own destination list
 * exactly (same ITEMS, same requiresAuth filtering) rather than a second
 * list that could drift from it.
 */
export function MobileNavMenu({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useTranslations("rail");
  const items = ITEMS.filter((navItem) => navItem.mvp && (!navItem.requiresAuth || isLoggedIn));

  return (
    <Dropdown
      triggerClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-white sm:hidden"
      triggerLabel={t("offers")}
      align="left"
      panelClassName="w-64 max-h-[70dvh] overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-sm"
      trigger={<Menu className="h-5 w-5" aria-hidden="true" />}
    >
      {(close) => (
        <>
          {items.map((navItem) => (
            <Link key={navItem.key} href={navItem.href} className={itemClass} onClick={close}>
              {navItem.icon}
              {t(navItem.key)}
            </Link>
          ))}
        </>
      )}
    </Dropdown>
  );
}
