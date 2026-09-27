"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const item = "block w-full truncate px-3 py-2 text-left text-sm text-ink hover:bg-paper";

type Profile = { fullName: string | null; avatarUrl: string | null };

function Avatar({ label, avatarUrl }: { label: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
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

/**
 * Signed-out: the role-split login dropdown (§9.2). Signed-in: a circular
 * avatar (candidate's own picture, else initials) opening a real nav menu —
 * a real-usage report found the plain email text read as dated, and `Rail`
 * is hidden below `sm`, so this doubles as the only nav mobile visitors get;
 * its links mirror Rail's own destinations. Also owns "Add offer" visibility
 * (only ever shown logged-out — a signed-in candidate has no use for it) so
 * both pieces share one auth read instead of two. Client-only: reads the
 * browser session directly rather than threading auth state through every
 * server layout.
 */
export function LoginMenu() {
  const t = useTranslations("nav");
  const rail = useTranslations("rail");
  const router = useRouter();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile() {
      const { data } = await supabase.auth.getUser();
      const currentEmail = data.user?.email ?? null;
      setEmail(currentEmail);
      if (!currentEmail) {
        setProfile(null);
        return;
      }
      // Avatar/name live only on `candidates` (candidate-profile.ts), never
      // synced to auth user_metadata — one extra read, RLS-scoped to the
      // caller's own row same as getMyCandidateProfile.
      const { data: candidate } = await supabase
        .from("candidates")
        .select("full_name, avatar_url")
        .maybeSingle();
      setProfile(candidate ? { fullName: candidate.full_name, avatarUrl: candidate.avatar_url } : null);
    }

    loadProfile();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (email === undefined) {
    return <div className="h-9 w-9 rounded-full bg-line/40" aria-hidden />;
  }

  if (email) {
    const label = profile?.fullName || email;
    return (
      <details className="relative">
        <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full">
          <Avatar label={label} avatarUrl={profile?.avatarUrl ?? null} />
          <span className="sr-only">{label}</span>
        </summary>
        <div className="absolute right-0 mt-1 w-56 rounded-lg border border-line bg-white py-1 shadow-sm">
          <p className="truncate px-3 pt-1 pb-2 text-sm font-medium text-ink">{label}</p>
          <hr className="mb-1 border-line" />
          <Link href="/jobs" className={item}>
            {rail("offers")}
          </Link>
          <Link href="/applications" className={item}>
            {rail("applications")}
          </Link>
          <Link href="/favorites" className={item}>
            {rail("favorites")}
          </Link>
          <Link href="/companies" className={item}>
            {rail("companies")}
          </Link>
          <Link href="/profile" className={item}>
            {rail("profile")}
          </Link>
          <Link href="/settings" className={item}>
            {rail("settings")}
          </Link>
          <hr className="my-1 border-line" />
          <button type="button" onClick={handleLogOut} className={item}>
            {t("logOut")}
          </button>
        </div>
      </details>
    );
  }

  return (
    <>
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
      <Link
        href="/recruit"
        className="flex h-9 items-center rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90"
      >
        {t("addOffer")}
      </Link>
    </>
  );
}
