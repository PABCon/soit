import { redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

/** /map folded into /jobs's split list+map view (phase 4). A permanent
 *  redirect, not a 404 — real bookmarks/indexed links may still point here. */
export default async function MapRedirectPage({ params }: Props) {
  const { locale } = await params;
  redirect({ href: "/jobs", locale });
}
