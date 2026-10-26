import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import { saveJob, type JobFormInput } from "@/lib/db/jobs";

const CLAIM_INVITE_TTL_DAYS = 60;

/** Unguessable, URL-safe — same shape as every other token in this codebase
 *  (employer_invites, team invites). 32 bytes of entropy, base64url so it's
 *  safe to drop straight into a URL path segment with no escaping. */
function generateClaimToken(): string {
  return randomBytes(32).toString("base64url");
}

export type UnclaimedCompanyProfile = {
  companyName: string;
  website?: string | null;
  logoUrl?: string | null;
  industry?: string | null;
  companySize?: string | null;
  description?: string | null;
};

/**
 * Operator-only (§claim-invites) — creates a new unclaimed company shell
 * (no NIF, no owner) plus zero or more draft jobs under it, and a one-time
 * claim token to email a prospect. Run directly (a script, or me acting as
 * the "admin tool" this feature deliberately doesn't have a UI for yet —
 * see the claim-invites product note) against a company/jobs you've
 * already scraped with extractCompanyProfileFromUrl/extractJobFromUrl;
 * this function itself does no scraping, just the writes.
 *
 * Draft jobs commonly have no salary at all (`jobs_published_requires_
 * salary` already allows this for any draft, not new to this feature) —
 * exactly expected here, since the whole pitch is "every Just IT listing
 * has a real salary, unlike where we found you" — claiming is explicitly
 * not "click publish," it's "review, add the one thing missing, publish."
 */
export async function createUnclaimedCompanyWithJobs(
  profile: UnclaimedCompanyProfile,
  // A builder, not a plain array — tech-tag resolution (resolveExtractedJobVocab)
  // logs unmatched-tag requests against a real company id, so the caller
  // needs this company's real id (not a placeholder) before building its
  // final JobFormInput list.
  buildJobs: (companyId: string) => Promise<JobFormInput[]>,
): Promise<{ companyId: string; claimToken: string; claimUrl: string; jobIds: string[] }> {
  const admin = createAdminClient();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      company_name: profile.companyName,
      slug: slugify(profile.companyName),
      nif: null,
      verification_status: "unclaimed",
      website: profile.website ?? null,
      company_logo_url: profile.logoUrl ?? null,
      industry: profile.industry ?? null,
      company_size: profile.companySize ?? null,
      company_description: profile.description ?? null,
    })
    .select("id")
    .single();
  if (companyError) throw new Error(`unclaimed company creation failed: ${companyError.message}`);

  const jobs = await buildJobs(company.id);

  const jobIds: string[] = [];
  for (const job of jobs) {
    // override lets saveJob operate without a real employer session — the
    // exact same escape hatch the public API already uses (resolveJobWriteContext),
    // just pointed at a company nobody has claimed yet instead of an
    // authenticated one's own company.
    const result = await saveJob(null, { ...job, publish: false }, { companyId: company.id });
    jobIds.push(result.id);
  }

  const token = generateClaimToken();
  const expiresAt = new Date(Date.now() + CLAIM_INVITE_TTL_DAYS * 864e5);
  const { error: inviteError } = await admin
    .from("company_claim_invites")
    .insert({ company_id: company.id, token, expires_at: expiresAt.toISOString() });
  if (inviteError) throw new Error(`claim invite creation failed: ${inviteError.message}`);

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return { companyId: company.id, claimToken: token, claimUrl: `${SITE}/en/employer/claim/${token}`, jobIds };
}

export type ClaimPreview = {
  companyName: string;
  logoUrl: string | null;
  draftJobTitles: string[];
};

/**
 * Resolves a claim token for the public claim page — admin client, same
 * reasoning as `getInviteByToken` (team invites): the visitor clicking
 * this link isn't authenticated as the company yet, so there's no
 * authenticated-role RLS policy that could ever apply here anyway. Returns
 * null for an unknown, expired, or already-claimed token, or one whose
 * company somehow isn't `unclaimed` anymore (defensive — the claim itself
 * is the real guard, this just keeps the preview page honest).
 */
export async function getClaimPreview(token: string): Promise<ClaimPreview | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("company_claim_invites")
    .select("company_id, expires_at, claimed_at, companies(company_name, company_logo_url, verification_status)")
    .eq("token", token)
    .maybeSingle();

  if (!data || data.claimed_at || new Date(data.expires_at) < new Date()) return null;
  const company = data.companies as unknown as {
    company_name: string;
    company_logo_url: string | null;
    verification_status: string;
  } | null;
  if (!company || company.verification_status !== "unclaimed") return null;

  const { data: jobs } = await admin.from("jobs").select("title").eq("company_id", data.company_id).eq("status", "draft");

  return {
    companyName: company.company_name,
    logoUrl: company.company_logo_url,
    draftJobTitles: (jobs ?? []).map((j) => j.title),
  };
}
