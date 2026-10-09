import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployerContext } from "./companies";
import { sendEmail } from "@/lib/email/send";
import { techTagRequestedEmail } from "@/lib/email/templates/tech-tag-requested";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "hello@justit.pt";

export async function getTechTags() {
  const supabase = await createClient();
  const { data } = await supabase.from("tech_tags").select("id, slug, label, aliases").order("label");
  return data ?? [];
}

export type FeaturedTechCount = { slug: string; label: string; group: "language" | "technology"; count: number };

/** Powers the "Browse by language"/"Browse by technology" sections on
 *  `/jobs` — a small curated subset of `tech_tags` (§ real-usage QA: "most
 *  common ones, don't overwhelm people"), counted only among currently
 *  live jobs, same "never advertise an empty link" rule as location/
 *  category. Small dataset (20 featured tags, few live jobs today) — one
 *  query, aggregated in memory, not 20 per-tag count queries. */
export async function getFeaturedTechCounts(): Promise<FeaturedTechCount[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_tech_tags")
    .select("tech_tags!inner(slug, label, featured_group), jobs!inner(status, expires_at)")
    .eq("jobs.status", "published")
    .gt("jobs.expires_at", new Date().toISOString());

  const counts = new Map<string, FeaturedTechCount>();
  for (const row of (data ?? []) as unknown as {
    tech_tags: { slug: string; label: string; featured_group: "language" | "technology" | null };
  }[]) {
    const tag = row.tech_tags;
    if (!tag.featured_group) continue;
    const existing = counts.get(tag.slug);
    if (existing) existing.count += 1;
    else counts.set(tag.slug, { slug: tag.slug, label: tag.label, group: tag.featured_group, count: 1 });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function normalizeTechLabel(label: string): string {
  return label.trim().toLowerCase();
}

export type RequestTechTagResult =
  | { ok: true; status: "received" | "already_requested" }
  | { ok: false; reason: "not_an_employer" | "invalid" | "already_exists" };

/**
 * "Request to add a technology" (real-usage QA item) — `tech_tags` is a
 * deliberately curated relation (§5.6), not free text, so an employer
 * who can't find their stack had no path forward at all before this.
 *
 * "Dedupe": checked against the real vocabulary first (label or any
 * alias, case-insensitive — small table, the existing `getTechTags()`
 * pattern already does this same "fetch it all, compare in memory"
 * rather than a dozen tiny queries), then against other employers'
 * pending requests for the same normalized label, bumping a counter
 * instead of inserting a near-duplicate row.
 *
 * "Verify real -> add": deliberately NOT automatic — this project has no
 * admin panel at all yet, and building one just for this would be a far
 * bigger, unrelated lift. A request landing here instead sends a plain
 * notification email to CONTACT_EMAIL (the same inbox the contact form
 * already reaches); a human decides whether it's a genuine, distinct
 * technology and adds the row to `tech_tags` directly.
 */
export async function requestTechTag(rawLabel: string): Promise<RequestTechTagResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const label = rawLabel.trim();
  if (label.length < 2 || label.length > 40) return { ok: false, reason: "invalid" };
  const normalized = normalizeTechLabel(label);

  const admin = createAdminClient();

  const { data: existingTags } = await admin.from("tech_tags").select("label, aliases");
  const alreadySupported = (existingTags ?? []).some(
    (t) => normalizeTechLabel(t.label) === normalized || t.aliases.some((alias: string) => normalizeTechLabel(alias) === normalized),
  );
  if (alreadySupported) return { ok: false, reason: "already_exists" };

  const { data: existingRequest } = await admin
    .from("tech_tag_requests")
    .select("id, request_count")
    .eq("normalized_label", normalized)
    .maybeSingle();

  if (existingRequest) {
    await admin
      .from("tech_tag_requests")
      .update({ request_count: existingRequest.request_count + 1, last_requested_at: new Date().toISOString() })
      .eq("id", existingRequest.id);
    return { ok: true, status: "already_requested" };
  }

  await admin.from("tech_tag_requests").insert({
    normalized_label: normalized,
    requested_label: label,
    requested_by_company_id: ctx.company.id,
  });

  await sendEmail(techTagRequestedEmail({ to: CONTACT_EMAIL, label, companyName: ctx.company.company_name }));

  return { ok: true, status: "received" };
}
