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

  const landingPath = role === "employer" ? "/recruit" : "/jobs";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();

    try {
      if (mode === "register") {
        let pendingNif: string | undefined;
        if (role === "employer") {
          const validation = validateNif(nif);
          if (!validation.valid) {
            setError(t(`nifError.${validation.reason}`));
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
          return;
        }

        // Supabase Auth is one auth.users row per email across the whole
        // project — signUp() against an email that already has a confirmed
        // account (e.g. an employer registering the same email as a
        // candidate) returns 200 with no error, an empty `identities` array,
        // and no session, to avoid leaking which emails are registered. Left
        // unchecked, this silently falls into "check your email" below for
        // a confirmation link that will never arrive.
        if (data.user && data.user.identities?.length === 0) {
          setError(t("emailAlreadyRegistered"));
          return;
        }

        if (data.session) {
          const res = await fetch("/api/auth/finish", { method: "POST" });
          const json = await res.json();
          router.push(next ?? json.landingPath ?? landingPath);
        } else {
          setCheckEmail(true);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }

        const res = await fetch("/api/auth/landing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferredRole: role }),
        });
        const json = await res.json();
        if (json.landingPath) router.push(next ?? json.landingPath);
        else setError(t("noProfile"));
      }
    } finally {
      setPending(false);
    }
  }

  async function handleOAuth(provider: (typeof OAUTH_PROVIDERS)[number]) {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/${locale}${next ?? landingPath}` },
    });
  }

  if (checkEmail) {
    return <p className="text-sm text-ink">{t("checkEmail")}</p>;
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
        className="h-9 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
      >
        {t(mode === "register" ? "createAccount" : "logIn")}
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
