import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
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

  // Real-usage report: an employer session had no business browsing the
  // candidate surface at all — beyond the confusing UX, it's what exposed
  // a real RLS-scoping bug on /applications (see getMyApplications). A
  // session that has an employer profile but no candidate profile of its
  // own gets bounced to /recruit before any of this shell renders; a
  // genuine dual-role account (§6.4a) — has both — is unaffected.
  //
  // Deliberately fails open: this surface is public and SEO-critical, so a
  // broken/stale session cookie must never 500 it for an anonymous visitor
  // — worst case here is just skipping the redirect, not crashing the page.
  let blockEmployer = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [{ data: employer }, { data: candidate }] = await Promise.all([
        supabase.from("employer_users").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("candidates").select("id").eq("auth_user_id", user.id).maybeSingle(),
      ]);
      blockEmployer = !!employer && !candidate;
    }
  } catch {
    blockEmployer = false;
  }
  if (blockEmployer) redirect({ href: "/recruit", locale });

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
