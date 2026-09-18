import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Two distinct free families for a technical audience (§11).
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-src",
  display: "swap",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-src",
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
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body className="bg-paper text-ink antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
