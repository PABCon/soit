import { getTranslations } from "next-intl/server";
import { Briefcase, Users, CreditCard } from "lucide-react";

const TOPICS = [
  { Icon: Briefcase, titleKey: "topicJobsTitle", descriptionKey: "topicJobsDescription" },
  { Icon: Users, titleKey: "topicAccountTitle", descriptionKey: "topicAccountDescription" },
  { Icon: CreditCard, titleKey: "topicBillingTitle", descriptionKey: "topicBillingDescription" },
] as const;

/** Purely informational — per the reference, these three topics are not
 *  links or a routed contact-category picker, just context for what the
 *  single form on the left can help with. */
export async function ContactHelpTopics({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "contact" });

  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <h2 className="text-lg font-semibold text-ink">{t("helpHeading")}</h2>
      <p className="mt-1 text-sm text-muted">{t("helpSubtitle")}</p>
      <ul className="mt-5 divide-y divide-line">
        {TOPICS.map(({ Icon, titleKey, descriptionKey }) => (
          <li key={titleKey} className="flex gap-3 py-4 first:pt-0 last:pb-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-subtle text-pine">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-ink">{t(`topics.${titleKey}`)}</p>
              <p className="mt-0.5 text-sm text-muted">{t(`topics.${descriptionKey}`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
