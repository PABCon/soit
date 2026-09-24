"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { validateNif } from "@/lib/nif";

/** Only ever honour a same-origin relative path — never redirect based on
 *  an attacker-controlled `next` value (open-redirect). */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

type Role = "candidate" | "employer";
type Mode = "login" | "register";

const OAUTH_PROVIDERS = ["google", "github", "linkedin_oidc"] as const;

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

/**
 * One form for all four entry points (§9.2): candidate/employer ×
 * login/register. Employer registration additionally collects the NIF,
 * validated inline (§5.7.2) before anything hits the network. The rest of
 * the flow — profile creation, claiming, verification — happens server-side
 * in /auth/callback and /api/auth/finish once a session exists.
 */
export function AuthForm({ role, mode }: { role: Role; mode: Mode }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nif, setNif] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [pending, setPending] = useState(false);
  // §6.4a — same-email dual-role: set once signInWithPassword confirms this
  // really is the account's owner, before anything is attached.
  const [attachOffer, setAttachOffer] = useState<{ nif?: string; companyName?: string } | null>(null);

  const landingPath = role === "employer" ? "/recruit" : "/jobs";
  const otherRole: Role = role === "employer" ? "candidate" : "employer";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();

    // Deliberately no try/finally resetting `pending` unconditionally: once
    // router.push() is about to swap this page out, the loading state
    // should stay visible through the handoff, not flip back to an idle-
    // looking button while the navigation is still in flight. Resetting it
    // early was exactly what made a slow navigation look like nothing was
    // happening at all — the button read as done while the page hadn't
    // actually changed yet. Every non-navigating exit path resets it
    // explicitly instead.
    if (mode === "register") {
      let pendingNif: string | undefined;
      if (role === "employer") {
        const validation = validateNif(nif);
        if (!validation.valid) {
          setError(t(`nifError.${validation.reason}`));
          setPending(false);
          return;
        }
        pendingNif = validation.nif;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}${next ?? landingPath}`,
          data: {
            last_role: role,
            ...(role === "employer"
              ? { pending_nif: pendingNif, pending_company_name: companyName }
              : {}),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setPending(false);
        return;
      }

      // Supabase Auth is one auth.users row per email across the whole
      // project — signUp() against an email that already has a confirmed
      // account (e.g. an employer registering the same email as a
      // candidate) returns 200 with no error, an empty `identities` array,
      // and no session, to avoid leaking which emails are registered. Left
      // unchecked, this used to fall into "check your email" below for a
      // confirmation link that would never arrive.
      //
      // §6.4a: this might genuinely be the same person adding their
      // second role under one login (what you agreed to support) rather
      // than someone guessing at a stranger's email — the only way to
      // tell the two apart is to check whether the password they just
      // typed for THIS registration is actually the existing account's
      // real password.
      if (data.user && data.user.identities?.length === 0) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError || !signInData.session) {
          setError(t("emailAlreadyRegistered"));
          setPending(false);
          return;
        }
        // Correct password — this really is the account's owner. Don't
        // attach automatically; offer it explicitly, per your call.
        setAttachOffer({ nif: pendingNif, companyName });
        setPending(false);
        return;
      }

      if (data.session) {
        const res = await fetch("/api/auth/finish", { method: "POST" });
        const json = await res.json();
        router.push(next ?? json.landingPath ?? landingPath);
        // no setPending(false) — navigating away
      } else {
        setCheckEmail(true);
        setPending(false);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setPending(false);
        return;
      }

      const res = await fetch("/api/auth/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredRole: role }),
      });
      const json = await res.json();
      if (json.landingPath) {
        router.push(next ?? json.landingPath);
        // no setPending(false) — navigating away
      } else {
        setError(t("noProfile"));
        setPending(false);
      }
    }
  }

  async function handleOAuth(provider: (typeof OAUTH_PROVIDERS)[number]) {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // §6.4a — OAuth has no metadata channel at sign-in time, unlike
        // signUp()'s `data` option, so intended role has to travel as an
        // explicit query param for /auth/callback to read.
        redirectTo: `${window.location.origin}/auth/callback?next=/${locale}${next ?? landingPath}&role=${role}`,
      },
    });
  }

  async function handleAttachConfirm() {
    if (!attachOffer) return;
    setPending(true);
    const res = await fetch("/api/auth/attach-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, nif: attachOffer.nif, companyName: attachOffer.companyName }),
    });
    const json = await res.json();
    if (!res.ok) {
      setAttachOffer(null);
      setError(t("errorGeneric"));
      setPending(false);
      return;
    }
    router.push(next ?? json.landingPath ?? landingPath);
    router.refresh();
    // no setPending(false) — navigating away
  }

  async function handleAttachCancel() {
    // A session was established as a side effect of the password probe —
    // leaving it active without consent isn't acceptable.
    const supabase = createClient();
    await supabase.auth.signOut();
    setAttachOffer(null);
    setPassword("");
  }

  if (checkEmail) {
    return <p className="text-sm text-ink">{t("checkEmail")}</p>;
  }

  if (attachOffer) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink">{t("attachOfferBody", { otherRole: t(`roleName.${otherRole}`), role: t(`roleName.${role}`) })}</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleAttachConfirm}
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
          >
            {pending && (
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {t("attachOfferConfirm")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleAttachCancel}
            className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:border-muted disabled:opacity-50"
          >
            {t("attachOfferCancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <label className={labelClass}>
        <span>{t("email")}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        <span>{t("password")}</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>

      {mode === "login" && (
        <Link href="/forgot-password" className="-mt-2 self-start text-xs text-pine hover:underline">
          {t("forgotPassword")}
        </Link>
      )}

      {mode === "register" && role === "employer" && (
        <>
          <label className={labelClass}>
            <span>{t("companyName")}</span>
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span>{t("nif")}</span>
            <input required value={nif} onChange={(e) => setNif(e.target.value)} className={inputClass} />
          </label>
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-9 items-center justify-center gap-2 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
      >
        {pending && (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {t(pending ? (mode === "register" ? "creatingAccount" : "loggingIn") : mode === "register" ? "createAccount" : "logIn")}
      </button>

      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="h-px flex-1 bg-line" aria-hidden />
        {t("orContinueWith")}
        <span className="h-px flex-1 bg-line" aria-hidden />
      </div>

      <div className="flex gap-2">
        {OAUTH_PROVIDERS.map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => handleOAuth(provider)}
            className="h-9 flex-1 rounded-lg border border-line bg-white text-sm hover:bg-paper"
          >
            {t(`provider.${provider}`)}
          </button>
        ))}
      </div>
    </form>
  );
}
