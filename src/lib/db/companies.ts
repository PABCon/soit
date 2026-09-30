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
  location_id: string | null;
  address: string | null;
  ad_credits_available: number;
  top_employer_active: boolean;
  top_employer_period_end: string | null;
  about_us_text: string | null;
  how_we_work_text: string | null;
  benefits_text: string | null;
  custom_section_title: string | null;
  custom_section_body: string | null;
};

export type CompanyTeamMember = { id: string; name: string; role: string | null };
export type CompanyTestimonial = { id: string; name: string; role: string | null; quote: string };
export type CompanyGalleryPhoto = { id: string; url: string };
export type CompanyGalleryVideo = { id: string; title: string; url: string };

export type CompanyRichProfileLists = {
  teamMembers: CompanyTeamMember[];
  testimonials: CompanyTestimonial[];
  galleryPhotos: CompanyGalleryPhoto[];
  galleryVideos: CompanyGalleryVideo[];
};

/** Shared by the console page (always, so an owner can see/edit their own
 *  data even while Top-Employer-gated and blurred) and `getCompanyBySlug`
 *  (only when `top_employer_active`). All four tables are public-select, so
 *  a plain scoped client is enough — no admin client needed. */
async function fetchCompanyRichProfileLists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
): Promise<CompanyRichProfileLists> {
  const [team, testimonials, photos, videos] = await Promise.all([
    supabase
      .from("company_team_members")
      .select("id, name, role")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("company_testimonials")
      .select("id, name, role, quote")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("company_gallery_photos")
      .select("id, url")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("company_gallery_videos")
      .select("id, title, url")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    teamMembers: team.data ?? [],
    testimonials: testimonials.data ?? [],
    galleryPhotos: photos.data ?? [],
    galleryVideos: videos.data ?? [],
  };
}

export async function getMyCompanyRichProfile(companyId: string): Promise<CompanyRichProfileLists> {
  const supabase = await createClient();
  return fetchCompanyRichProfileLists(supabase, companyId);
}

/** Delete-then-reinsert — same convention as `job_tech_tags`/
 *  `candidate_experience`: no explicit `position` column, order is array
 *  order at save time + `order by created_at asc` on read. */
export async function saveCompanyTeamMembers(members: { name: string; role: string | null }[]) {
  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) throw new Error("not an employer");

  await supabase.from("company_team_members").delete().eq("company_id", companyId);
  const rows = members.filter((m) => m.name.trim()).map((m) => ({
    company_id: companyId,
    name: m.name.trim(),
    role: m.role?.trim() || null,
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from("company_team_members").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function saveCompanyTestimonials(
  testimonials: { name: string; role: string | null; quote: string }[],
) {
  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) throw new Error("not an employer");

  await supabase.from("company_testimonials").delete().eq("company_id", companyId);
  const rows = testimonials
    .filter((t) => t.name.trim() && t.quote.trim())
    .map((t) => ({ company_id: companyId, name: t.name.trim(), role: t.role?.trim() || null, quote: t.quote.trim() }));
  if (rows.length > 0) {
    const { error } = await supabase.from("company_testimonials").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function saveCompanyGalleryVideos(videos: { title: string; url: string }[]) {
  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) throw new Error("not an employer");

  await supabase.from("company_gallery_videos").delete().eq("company_id", companyId);
  const rows = videos
    .filter((v) => v.title.trim() && v.url.trim())
    .map((v) => ({ company_id: companyId, title: v.title.trim(), url: v.url.trim() }));
  if (rows.length > 0) {
    const { error } = await supabase.from("company_gallery_videos").insert(rows);
    if (error) throw new Error(error.message);
  }
}

/** Photo gallery rows are inserted one at a time (upload-then-insert), not
 *  saved as a whole array like the other three — each "add" is an
 *  immediate upload, not queued for a batch save (see
 *  `uploadGalleryPhotoAction`). */
export async function addCompanyGalleryPhoto(url: string) {
  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) throw new Error("not an employer");
  const { error } = await supabase.from("company_gallery_photos").insert({ company_id: companyId, url });
  if (error) throw new Error(error.message);
}

/** Returns the removed row's `url` (or `null` if nothing matched — RLS
 *  scopes the delete to the caller's own company, so a foreign id is a
 *  silent no-op, not an error) so the caller can also clean up the
 *  underlying `branding` bucket object. */
export async function removeCompanyGalleryPhoto(photoId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_gallery_photos")
    .delete()
    .eq("id", photoId)
    .select("url")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.url ?? null;
}

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Unfiltered .single() here was a real bug: the "see colleagues" RLS
  // policy on employer_users returns every row at the caller's company,
  // not just their own — so this errored (and silently returned null,
  // rendering "not an employer") for any company with more than one team
  // member. auth_user_id is unique per employer_users row, so filtering by
  // it — and using maybeSingle(), not single() — is the actual fix.
  const { data: employerRow } = await supabase
    .from("employer_users")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
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

export type CompanyLocation = { name: string; latitude: number; longitude: number };

export type PublicRichProfile = CompanyRichProfileLists & {
  topEmployerActive: boolean;
  aboutUsText: string | null;
  howWeWorkText: string | null;
  benefitsText: string | null;
  customSectionTitle: string | null;
  customSectionBody: string | null;
};

export async function getCompanyBySlug(slug: string): Promise<
  | (Company &
      PublicSocialLinks &
      PublicRichProfile & {
        description: string | null;
        website: string | null;
        industry: string | null;
        companySize: string | null;
        companyType: string | null;
        coverImageUrl: string | null;
        address: string | null;
        location: CompanyLocation | null;
      })
  | null
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select(
      `id, slug, company_name, company_logo_url, cover_image_url, company_description, website, industry, company_size, company_type, address, top_employer_active, about_us_text, how_we_work_text, benefits_text, custom_section_title, custom_section_body, locations ( name, latitude, longitude ), ${PUBLIC_SOCIAL_FIELDS}`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;

  const location = data.locations as unknown as CompanyLocation | null;

  // The rich-profile perk is Top-Employer-only: a non-subscriber's fields
  // are fetched (they're not gated by a column grant, same convention as
  // every other public profile field) but deliberately discarded here, so
  // the public page's existing "omit when empty" rendering does the right
  // thing with zero new conditional logic on that side.
  const richLists = data.top_employer_active
    ? await fetchCompanyRichProfileLists(supabase, data.id)
    : { teamMembers: [], testimonials: [], galleryPhotos: [], galleryVideos: [] };

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
    address: data.address,
    location,
    facebookUrl: data.facebook_url,
    linkedinUrl: data.linkedin_url,
    instagramUrl: data.instagram_url,
    youtubeUrl: data.youtube_url,
    tiktokUrl: data.tiktok_url,
    xUrl: data.x_url,
    topEmployerActive: data.top_employer_active,
    aboutUsText: data.top_employer_active ? data.about_us_text : null,
    howWeWorkText: data.top_employer_active ? data.how_we_work_text : null,
    benefitsText: data.top_employer_active ? data.benefits_text : null,
    customSectionTitle: data.top_employer_active ? data.custom_section_title : null,
    customSectionBody: data.top_employer_active ? data.custom_section_body : null,
    ...richLists,
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
  location_id: string | null;
  address: string | null;
  about_us_text: string | null;
  how_we_work_text: string | null;
  benefits_text: string | null;
  custom_section_title: string | null;
  custom_section_body: string | null;
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
