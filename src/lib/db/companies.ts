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

export async function getCompanyBySlug(slug: string): Promise<
  | (Company & {
      description: string | null;
      website: string | null;
      industry: string | null;
      companySize: string | null;
      coverImageUrl: string | null;
    })
  | null
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select(
      "slug, company_name, company_logo_url, cover_image_url, company_description, website, industry, company_size",
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
  };
}

export async function updateCompanyProfile(fields: {
  company_name: string;
  company_description: string | null;
  website: string | null;
  industry: string | null;
  company_size: string | null;
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
