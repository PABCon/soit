"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Deliberately outside `next-intl` — this page only ever exists for a few
 *  seconds in one specific flow, so a tiny inline EN/PT dictionary (picked
 *  from the browser's own language, same convention the root page's own
 *  Accept-Language redirect already uses) is proportionate; wiring up the
 *  full i18n provider outside `[locale]` for two sentences isn't. */
function useCopy() {
  const isPt = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("pt");
  return isPt
    ? {
        locale: "pt",
        title: "Confirmar a sua conta",
        body: "Clique no botão abaixo para ativar a sua conta Just IT.",
        confirm: "Confirmar a minha conta",
        confirming: "A confirmar…",
        invalidTitle: "Link inválido",
        invalidBody: "Este link de confirmação não é válido ou já foi usado.",
        errorTitle: "Não foi possível confirmar",
        errorBody: "Este link pode já ter sido usado ou ter expirado. Se já definiu uma password, experimente simplesmente iniciar sessão — o problema costuma resolver-se automaticamente ao entrar.",
        loginLink: "Iniciar sessão",
      }
    : {
        locale: "en",
        title: "Confirm your account",
        body: "Click the button below to activate your Just IT account.",
        confirm: "Confirm my account",
        confirming: "Confirming…",
        invalidTitle: "Invalid link",
        invalidBody: "This confirmation link isn't valid or has already been used.",
        errorTitle: "Couldn't confirm",
        errorBody: "This link may already have been used or expired. If you already set a password, try just logging in instead — this usually resolves itself automatically on login.",
        loginLink: "Log in",
      };
}

/** §auth security — this page exists specifically so that merely *visiting*
 *  the confirmation link (as a corporate email security scanner does,
 *  automatically, before the real person ever clicks) does nothing: the
 *  token is only ever consumed on an explicit button click, which an
 *  automated link-scanner essentially never simulates. The Supabase email
 *  template points here with `{{ .TokenHash }}` instead of the default
 *  `{{ .ConfirmationURL }}`, which performs the equivalent of this whole
 *  page's job the instant it's merely requested — exactly the gap that
 *  left a real registration (ITDS, 2026-10-21) stuck with a confirmed
 *  email but no company ever created. Scoped to signup only — password
 *  recovery keeps its own separate, unmodified template/flow. */
function ConfirmInner() {
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  const t = useCopy();

  if (!tokenHash || type !== "signup") {
    return <Message title={t.invalidTitle} body={t.invalidBody} />;
  }

  async function confirm() {
    setState("pending");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "signup" });
    if (error) {
      setState("error");
      return;
    }

    const res = await fetch("/api/auth/finish", { method: "POST" });
    const data = await res.json();
    const locale = t.locale;
    if (res.ok && data.landingPath) {
      window.location.assign(`/${locale}${data.landingPath}`);
    } else if (data.error === "duplicate_nif") {
      window.location.assign(`/${locale}/employer/register?error=duplicate_nif`);
    } else {
      setState("error");
    }
  }

  if (state === "error") {
    return <Message title={t.errorTitle} body={t.errorBody} loginHref={`/${t.locale}/employer/login`} loginLabel={t.loginLink} />;
  }

  return (
    <Shell>
      <h1 className="font-display text-2xl font-bold text-ink">{t.title}</h1>
      <p className="mt-3 text-sm text-muted">{t.body}</p>
      <button
        type="button"
        disabled={state === "pending"}
        onClick={confirm}
        className="mt-6 h-11 w-full rounded-lg bg-pine text-sm font-semibold text-white hover:bg-pine-hover disabled:opacity-50"
      >
        {state === "pending" ? t.confirming : t.confirm}
      </button>
    </Shell>
  );
}

function Message({ title, body, loginHref, loginLabel }: { title: string; body: string; loginHref?: string; loginLabel?: string }) {
  return (
    <Shell>
      <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-3 text-sm text-muted">{body}</p>
      {loginHref && (
        <a href={loginHref} className="mt-6 inline-block text-sm font-medium text-pine hover:underline">
          {loginLabel}
        </a>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-8 text-center">{children}</div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}
