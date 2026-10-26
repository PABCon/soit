import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployerContext } from "./companies";
import { sendEmail } from "@/lib/email/send";
import { techTagRequestedEmail } from "@/lib/email/templates/tech-tag-requested";
import { validateTechTag } from "@/lib/ai/validate-tech-tag";
import { slugify } from "@/lib/slug";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "hello@justit.pt";

export type TechTagOption = { id: string; slug: string; label: string; aliases: string[] };

export async function getTechTags(): Promise<TechTagOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tech_tags").select("id, slug, label, aliases").order("label");
  return data ?? [];
}

function normalizeTechLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function findMatchingTechTag(label: string, vocab: TechTagOption[]): TechTagOption | null {
  const norm = normalizeTechLabel(label);
  return vocab.find((t) => normalizeTechLabel(t.label) === norm || t.aliases.some((a) => normalizeTechLabel(a) === norm)) ?? null;
}

export type ResolveTechTagResult =
  | { ok: true; tag: TechTagOption }
  | { ok: false; reason: "invalid" | "rejected" };

/**
 * §job-import — the one place ANY unmatched tech/skill label (from the
 * manual "request a tag" button, the single-URL job autofill, or the
 * bulk career-page importer) gets resolved. Already-supported labels
 * resolve instantly with no LLM call; a genuinely new one is validated by
 * `validateTechTag` and, unless rejected, created (or merged as an alias
 * of an existing tag) immediately — no human review step, since this
 * project has no admin panel to clear a manual-review backlog with. Every
 * outcome is still logged to `tech_tag_requests` (auto_approved +
 * resulting_tech_tag_id) and emailed to CONTACT_EMAIL as a pure audit
 * record, not a gate — nothing waits on either.
 */
export async function resolveTechTagLabel(
  rawLabel: string,
  companyId: string,
  companyName: string,
): Promise<ResolveTechTagResult> {
  const label = rawLabel.trim();
  if (label.length < 2 || label.length > 40) return { ok: false, reason: "invalid" };
  const normalized = normalizeTechLabel(label);

  const admin = createAdminClient();

  const { data: existingTags } = await admin.from("tech_tags").select("id, slug, label, aliases");
  const vocab = (existingTags ?? []) as TechTagOption[];

  const already = findMatchingTechTag(label, vocab);
  if (already) return { ok: true, tag: already };

  const validation = await validateTechTag(label, vocab.map((t) => t.label));

  if (validation.decision === "reject") {
    await logTechTagRequest(normalized, label, companyId, { autoApproved: false, resultingTechTagId: null });
    await sendEmail(techTagRequestedEmail({ to: CONTACT_EMAIL, label, companyName, outcome: "rejected" }));
    return { ok: false, reason: "rejected" };
  }

  if (validation.decision === "alias_of_existing") {
    const match = vocab.find((t) => t.label === validation.matchedLabel);
    if (match) {
      const { data: updated } = await admin
        .from("tech_tags")
        .update({ aliases: [...new Set([...match.aliases, label])] })
        .eq("id", match.id)
        .select("id, slug, label, aliases")
        .single();
      await logTechTagRequest(normalized, label, companyId, { autoApproved: true, resultingTechTagId: match.id });
      await sendEmail(
        techTagRequestedEmail({ to: CONTACT_EMAIL, label, companyName, outcome: "aliased", matchedLabel: match.label }),
      );
      return { ok: true, tag: (updated as TechTagOption) ?? { ...match, aliases: [...match.aliases, label] } };
    }
    // Fall through to new_tag if the matched label somehow doesn't
    // resolve to a real row any more (shouldn't happen — validateTechTag
    // already checks this against the same vocab list).
  }

  const slug = await uniqueTechTagSlug(admin, label);
  const { data: created, error } = await admin
    .from("tech_tags")
    .insert({ slug, label, aliases: [] })
    .select("id, slug, label, aliases")
    .single();
  if (error || !created) {
    await logTechTagRequest(normalized, label, companyId, { autoApproved: false, resultingTechTagId: null });
    return { ok: false, reason: "rejected" };
  }

  await logTechTagRequest(normalized, label, companyId, { autoApproved: true, resultingTechTagId: created.id });
  await sendEmail(techTagRequestedEmail({ to: CONTACT_EMAIL, label, companyName, outcome: "created" }));
  return { ok: true, tag: created as TechTagOption };
}

async function uniqueTechTagSlug(admin: ReturnType<typeof createAdminClient>, label: string): Promise<string> {
  const base = slugify(label).replace(/-[a-z0-9]{6}$/, ""); // slugify() appends a random suffix we don't want here
  let candidate = base || "tag";
  let attempt = 0;
  while (true) {
    const { data } = await admin.from("tech_tags").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    attempt++;
    candidate = `${base}-${attempt + 1}`;
  }
}

async function logTechTagRequest(
  normalizedLabel: string,
  requestedLabel: string,
  companyId: string,
  outcome: { autoApproved: boolean; resultingTechTagId: string | null },
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("tech_tag_requests").insert({
    normalized_label: normalizedLabel,
    requested_label: requestedLabel,
    requested_by_company_id: companyId,
    status: outcome.autoApproved ? "approved" : "rejected",
    auto_approved: outcome.autoApproved,
    resulting_tech_tag_id: outcome.resultingTechTagId,
  });
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

/** Thin wrapper over resolveTechTagLabel for the one call site that has a
 *  real cookie session (the manual "request a tag" button in JobForm) —
 *  resolves the employer context itself so the action layer doesn't have
 *  to. Server-side callers with no session (the bulk importer) call
 *  resolveTechTagLabel directly with a companyId they already have. */
export async function requestTechTag(rawLabel: string): Promise<ResolveTechTagResult | { ok: false; reason: "not_an_employer" }> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };
  return resolveTechTagLabel(rawLabel, ctx.company.id, ctx.company.company_name);
}
