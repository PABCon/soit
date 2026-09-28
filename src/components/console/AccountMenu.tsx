"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/Dropdown";

const item = "block w-full truncate px-3 py-2 text-left text-sm text-ink hover:bg-paper";

function Avatar({ label, avatarUrl }: { label: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
      <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
    );
  }
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine text-sm font-semibold text-white">
      {initial}
    </span>
  );
}

/** The employer console's own avatar dropdown (real-usage report: no top
 *  navbar at all, unlike the candidate site's `LoginMenu`). Deliberately
 *  slimmer than `LoginMenu` — the console `Sidebar` is always visible (not
 *  hidden below `sm` the way the candidate `Rail` is), so this doesn't need
 *  to duplicate My Job Ads/Company Profile/Team as a mobile fallback nav,
 *  just the account-specific actions. `fullName`/`avatarUrl` are passed in
 *  from the server layout, which already reads the session — no second
 *  client-side auth fetch/loading flicker needed. */
export function AccountMenu({
  label,
  avatarUrl,
}: {
  label: string;
  avatarUrl: string | null;
}) {
  const t = useTranslations("console");
  const router = useRouter();

  async function handleLogOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Dropdown
      triggerLabel={label}
      triggerClassName="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full"
      panelClassName="w-56 rounded-lg border border-line bg-white py-1 shadow-sm"
      trigger={<Avatar label={label} avatarUrl={avatarUrl} />}
    >
      {(close) => (
        <>
          <p className="truncate px-3 pt-1 pb-2 text-sm font-medium text-ink">{label}</p>
          <hr className="mb-1 border-line" />
          <Link href="/recruit/settings" className={item} onClick={close}>
            {t("myAccount")}
          </Link>
          <hr className="my-1 border-line" />
          <button
            type="button"
            onClick={() => {
              close();
              handleLogOut();
            }}
            className={item}
          >
            {t("logOut")}
          </button>
        </>
      )}
    </Dropdown>
  );
}
