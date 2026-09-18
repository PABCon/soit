import { redirect } from "@/i18n/navigation";

/** Candidates land on the jobs list (§7.1). */
export default async function LocaleRoot({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/jobs", locale });
}
