"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const item = "block w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper";

/**
 * The role-split login dropdown (§9.2), now live — plus the signed-in
 * state, since the loop isn't demonstrable end-to-end if the nav still
 * shows a disabled login menu after registering. Client-only: it reads the
 * browser session directly rather than threading auth state through every
 * server layout.
 */
export function LoginMenu() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (email === undefined) {
    return <div className="h-9 w-20" aria-hidden />;
  }

  if (email) {
    return (
      <details className="relative">
        <summary className="flex h-9 max-w-40 cursor-pointer list-none items-center truncate rounded-lg px-3 text-sm font-medium text-ink hover:bg-white">
          {email}
        </summary>
        <div className="absolute right-0 mt-1 w-56 rounded-lg border border-line bg-white py-1 shadow-sm">
          <button type="button" onClick={handleLogOut} className={item}>
            {t("logOut")}
          </button>
        </div>
      </details>
    );
  }

  return (
    <details className="relative">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-lg px-3 text-sm font-medium text-ink hover:bg-white">
        {t("login")}
      </summary>
      <div className="absolute right-0 mt-1 w-64 rounded-lg border border-line bg-white py-1 shadow-sm">
        <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-ink">{t("groupCandidate")}</p>
        <Link href="/candidate/login" className={item}>
          {t("loginAsCandidate")}
        </Link>
        <Link href="/candidate/register" className={item}>
          {t("registerAsCandidate")}
        </Link>
        <hr className="my-1 border-line" />
        <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-ink">{t("groupEmployer")}</p>
        <Link href="/employer/login" className={item}>
          {t("loginAsEmployer")}
        </Link>
        <Link href="/employer/register" className={item}>
          {t("registerAsEmployer")}
        </Link>
      </div>
    </details>
  );
}
