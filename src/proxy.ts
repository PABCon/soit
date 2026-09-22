import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Locale negotiation (§2.2) plus the Supabase session-cookie refresh (the
 * standard @supabase/ssr middleware pattern) and the console access guard
 * (§6.4 — belt-and-suspenders; the real authorization is RLS, this is just
 * "don't show an anonymous visitor the login form after the fact").
 * Next 16 calls this convention "proxy"; next-intl still exports it as
 * createMiddleware — same function, same signature.
 */
const intlMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  // A locale-negotiation redirect (e.g. `/` → `/pt`) has no session to
  // refresh yet and no locale segment to guard against.
  if (response.status === 307 || response.status === 308) return response;

  // Defensive: this must never be able to take the whole site down. If the
  // session refresh fails for any reason, fall through with no guard — the
  // console layout does its own real auth check server-side (belt and
  // suspenders was the point; RLS is the actual security boundary either
  // way), so the worst case here is a logged-out visitor briefly seeing the
  // login form render instead of an instant redirect.
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const match = request.nextUrl.pathname.match(/^\/(pt|en)\/recruit(\/|$)/);
    if (match && !user) {
      return NextResponse.redirect(new URL(`/${match[1]}/employer/login`, request.url));
    }
  } catch (error) {
    console.error("proxy: session refresh failed", error);
  }

  return response;
}

export const config = {
  // Everything except API routes, the non-localized /auth/callback route,
  // Next internals and files with an extension.
  matcher: "/((?!api|auth|_next|_vercel|.*\\..*).*)",
};
