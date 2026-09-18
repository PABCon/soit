import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Locale negotiation (§2.2). Next 16 calls this convention "proxy";
 * next-intl still exports it as createMiddleware — same function, same signature.
 * Redirects `/` on Accept-Language, defaulting to pt.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
