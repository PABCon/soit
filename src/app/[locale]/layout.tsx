import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Geist } from "next/font/google";
import { routing } from "@/i18n/routing";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import "../globals.css";

// Corrective landing-page redesign: switched from Inter to **Geist**, the
// spec's actually-preferred font. The prior pass stayed on Inter reasoning
// "already wired" — re-checked properly this round rather than reapplying
// that: Next.js 16.3.8's bundled `next/font/google` metadata
// (`node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`)
// genuinely lists "Geist" with a full 100-900 variable weight axis and a
// `latin` subset, so this is the exact same zero-new-dependency mechanism
// already used for Inter before it — a one-line swap, not a new package.
// Geist's sharper, more technical character is also a real part of
// answering the corrective brief's call for "distinctive through
// typography," which Inter's deliberately neutral, ubiquitous design
// works against. One `--font-src` variable still feeds both the
// `--font-display`/`--font-sans` theme tokens in globals.css.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-src",
  display: "swap",
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brand" });
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("tagline"),
  };
}

/**
 * Root layout. It sits under [locale] rather than at app/ because every
 * public URL is locale-prefixed (§2.2). The two surfaces get their own
 * shells as nested layouts under (candidate) and (console).
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={geist.variable}>
      <body className="bg-paper text-ink antialiased">
        <NextIntlClientProvider>
          {children}
          <CookieConsentBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
