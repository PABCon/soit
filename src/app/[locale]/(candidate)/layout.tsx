import { setRequestLocale } from "next-intl/server";
import { Rail } from "@/components/candidate/Rail";
import { TopNav } from "@/components/candidate/TopNav";

/**
 * Candidate surface shell (§2.1, §7.1): the public, SEO-critical job site.
 * Separate from the console shell — they share tokens, the Supabase client
 * and the database, and nothing else.
 */
export default async function CandidateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
