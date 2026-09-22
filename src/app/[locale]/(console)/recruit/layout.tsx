import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCompany } from "@/lib/verification/verify-company";
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
 *
 * Authorization is row existence (§6.4), never a metadata flag — the proxy
 * middleware already turns away anonymous requests, this is the
 * belt-and-suspenders check plus the lazy VIES retry (§5.7.4).
 */
export default async function ConsoleLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/employer/login", locale });

  const { data: employerRow } = await supabase
    .from("employer_users")
    .select("company_id")
    .eq("auth_user_id", user!.id)
    .maybeSingle();
  if (!employerRow) redirect({ href: "/jobs", locale });

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("id, nif, verification_status, verification_next_retry_at")
    .eq("id", employerRow!.company_id)
    .single();

  if (
    company?.verification_status === "pending" &&
    (!company.verification_next_retry_at || new Date(company.verification_next_retry_at) <= new Date())
  ) {
    await verifyCompany(company.id, company.nif);
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
