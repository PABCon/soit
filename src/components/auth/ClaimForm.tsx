"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { validateNif } from "@/lib/nif";
import { passwordMeetsRequirements } from "@/lib/password";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

const inputClass = "h-11 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

/** "Claim your profile" form (§claim-invites) — a smaller AuthForm, scoped
 *  to the one thing this specific flow actually needs: unlike a team
 *  invite (InviteAcceptForm, no NIF since the company's already verified),
 *  a claimed company still has to prove it's really them via the same
 *  NIF/VIES check every fresh registration goes through — the claim link
 *  alone only proves they clicked an email, not that they represent this
 *  specific business. Company name isn't collected here at all: the
 *  company already exists (that's the whole point), so there's nothing to
 *  type — only email/password/NIF. */
export function ClaimForm({ token, email: fixedEmail }: { token: string; email?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();

  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState(fixedEmail ?? "");
  const [password, setPassword] = useState("");
  const [nif, setNif] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [pending, setPending] = useState(false);
  // GDPR/compliance audit finding: claiming a pre-built profile created a
  // real employer_users row with no terms/privacy acceptance recorded
  // anywhere — required in both modes, same reasoning as InviteAcceptForm.
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!termsAccepted) {
      setError(t("termsRequired"));
      return;
    }
    setPending(true);
    const supabase = createClient();
    const termsAcceptedAt = new Date().toISOString();

    // No unconditional finally resetting `pending` — same reasoning as
    // AuthForm/InviteAcceptForm: once router.push() is about to swap the
    // page out, the loading state should stay visible through the handoff.
    const validation = validateNif(nif);
    if (!validation.valid) {
      setError(t(`nifError.${validation.reason}`));
      setPending(false);
      return;
    }

    if (mode === "register") {
      if (!passwordMeetsRequirements(password)) {
        setError(t("passwordRequirementsNotMet"));
        setPending(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}/recruit`,
          data: {
            last_role: "employer",
            pending_nif: validation.nif,
            pending_claim_token: token,
            pending_terms_accepted_at: termsAcceptedAt,
            pending_terms_version: CURRENT_TERMS_VERSION,
          },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setPending(false);
        return;
      }
      if (data.session) {
        const res = await fetch("/api/auth/finish", { method: "POST" });
        const json = await res.json();
        router.push(json.landingPath ?? "/recruit");
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
      const res = await fetch("/api/auth/attach-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "employer",
          nif: validation.nif,
          claimToken: token,
          termsAcceptedAt,
          termsVersion: CURRENT_TERMS_VERSION,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Security audit finding: this used to display `json.error`
        // directly as user-facing text — attach-role's own error
        // responses are now internal reason codes, not display strings
        // (closing a raw-internal-error-message leak), same translated-
        // lookup pattern AuthForm.tsx already uses for this same route.
        setError(json.error === "duplicate_nif" ? t("nifError.duplicate") : t("errorGeneric"));
        setPending(false);
        return;
      }
      router.push(json.landingPath ?? "/recruit");
      router.refresh();
      // no setPending(false) — navigating away
    }
  }

  if (checkEmail) {
    return <p className="text-sm text-ink">{t("checkEmail")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label className={labelClass}>
        <span>{t("email")}</span>
        <input
          type="email"
          required
          disabled={!!fixedEmail}
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
          minLength={mode === "register" ? 8 : undefined}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      {mode === "register" && <PasswordChecklist password={password} />}

      <label className={labelClass}>
        <span>{t("nif")}</span>
        <input
          type="text"
          required
          inputMode="numeric"
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          placeholder="123456789"
          className={inputClass}
        />
      </label>

      <label className="flex items-start gap-2 text-xs text-muted">
        <input
          type="checkbox"
          required
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          {t("termsConsent")}{" "}
          <Link href="/terms" target="_blank" className="underline hover:text-ink">
            {t("termsLink")}
          </Link>{" "}
          {t("and")}{" "}
          <Link href="/privacy" target="_blank" className="underline hover:text-ink">
            {t("privacyPolicyLink")}
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={pending || !termsAccepted}
        className="flex h-11 items-center justify-center gap-2 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
      >
        {pending && (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {t(pending ? (mode === "register" ? "creatingAccount" : "loggingIn") : mode === "register" ? "createAccount" : "logIn")}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "register" ? "login" : "register")}
        className="text-sm text-muted underline underline-offset-2"
      >
        {mode === "register" ? t("alreadyHaveAccount") : t("needAccount")}
      </button>
    </form>
  );
}
