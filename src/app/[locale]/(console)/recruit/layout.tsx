import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/console/Sidebar";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "console" });
  // The console sits behind login and must never be indexed (§2, §4).
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Employer console shell (§2.1, §7.2). Employers land here, never in the
 * candidate feed. Clean and functional — clarity over flourish (§11).
 */
export default async function ConsoleLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
