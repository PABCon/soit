import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types";

export type VerificationStatus = "unverified" | "pending" | "verified" | "failed";

export type MyCompany = {
  id: string;
  company_name: string;
  slug: string;
  nif: string;
  verification_status: VerificationStatus;
  company_logo_url: string | null;
  cover_image_url: string | null;
  company_description: string | null;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  company_type: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  x_url: string | null;
};

export type EmployerContext = {
  employerId: string;
  role: "owner" | "member";
  company: MyCompany;
};

/**
 * The one call the console needs to know "who am I, and what can I touch."
 * `my_company()` is the SECURITY DEFINER function step 2 built exactly for
 * this — it bypasses the column-privilege restriction that keeps `nif`/
 * `verification_*` off the public `companies` select, without needing the
 * admin client (the caller can only ever get their own company back).
 */
export async function getMyEmployerContext(): Promise<EmployerContext | null> {
  const supabase = await createClient();

  const { data: employerRow } = await supabase
    .from("employer_users")
    .select("id, role")
    .single();
  if (!employerRow) return null;

  const { data: company } = await supabase.rpc("my_company");
  if (!company) return null;

  return { employerId: employerRow.id, role: employerRow.role, company: company as MyCompany };
}

const PUBLIC_SOCIAL_FIELDS =
  "facebook_url, linkedin_url, instagram_url, youtube_url, tiktok_url, x_url";

export type PublicSocialLinks = {
  facebookUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  xUrl: string | null;
};

export async function getCompanyBySlug(slug: string): Promise<
  | (Company &
      PublicSocialLinks & {
        description: string | null;
        website: string | null;
        industry: string | null;
        companySize: string | null;
        companyType: string | null;
        coverImageUrl: string | null;
      })
  | null
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select(
      `slug, company_name, company_logo_url, cover_image_url, company_description, website, industry, company_size, company_type, ${PUBLIC_SOCIAL_FIELDS}`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;

  return {
    slug: data.slug,
    name: data.company_name,
    logoUrl: data.company_logo_url,
    coverImageUrl: data.cover_image_url,
    description: data.company_description,
    website: data.website,
    industry: data.industry,
    companySize: data.company_size,
    companyType: data.company_type,
    facebookUrl: data.facebook_url,
    linkedinUrl: data.linkedin_url,
    instagramUrl: data.instagram_url,
    youtubeUrl: data.youtube_url,
    tiktokUrl: data.tiktok_url,
    xUrl: data.x_url,
  };
}

export type CompanyListItem = {
  slug: string;
  name: string;
  logoUrl: string | null;
  industry: string | null;
  companyType: string | null;
  activeJobsCount: number;
  primaryLocation: string | null;
};

/** Powers `/companies` (§7.1) — every company with at least one live job.
 *  Membership is derived from `jobs`, not filtered on `companies.
 *  verification_status` directly: that column is deliberately outside the
 *  public column-privilege grant (RLS §6, "NOT the verification columns"),
 *  and unverified companies can never have a published job (spec rule #2)
 *  anyway, so "has a live job" is an equivalent, privilege-clean proxy. */
export async function getVerifiedCompanies(): Promise<CompanyListItem[]> {
  const supabase = await createClient();

  const { data: liveJobs } = await supabase
    .from("jobs")
    .select("location, companies!inner(slug, company_name, company_logo_url, industry, company_type)")
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString());

  const bySlug = new Map<
    string,
    { company: { company_name: string; company_logo_url: string | null; industry: string | null; company_type: string | null }; count: number; location: string | null }
  >();
  for (const job of (liveJobs ?? []) as unknown as {
    location: string | null;
    companies: { slug: string; company_name: string; company_logo_url: string | null; industry: string | null; company_type: string | null };
  }[]) {
    const entry = bySlug.get(job.companies.slug);
    if (entry) {
      entry.count += 1;
      if (!entry.location && job.location) entry.location = job.location;
    } else {
      bySlug.set(job.companies.slug, { company: job.companies, count: 1, location: job.location });
    }
  }

  return [...bySlug.entries()]
    .map(([slug, agg]) => {
      const c = agg.company;
      return {
        slug,
        name: c.company_name,
        logoUrl: c.company_logo_url,
        industry: c.industry,
        companyType: c.company_type,
        activeJobsCount: agg?.count ?? 0,
        primaryLocation: agg?.location ?? null,
      };
    })
    .sort((a, b) => b.activeJobsCount - a.activeJobsCount || a.name.localeCompare(b.name));
}

export async function updateCompanyProfile(fields: {
  company_name: string;
  company_description: string | null;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  company_type: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  x_url: string | null;
}) {
  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  const { error } = await supabase.from("companies").update(fields).eq("id", companyId);
  if (error) throw new Error(error.message);
}

export async function updateCompanyImage(field: "company_logo_url" | "cover_image_url", url: string) {
  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  const { error } = await supabase
    .from("companies")
    .update({ [field]: url })
    .eq("id", companyId);
  if (error) throw new Error(error.message);
}
