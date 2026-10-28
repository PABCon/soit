"use server";

import { createClient } from "@/lib/supabase/server";
import {
  updateCompanyProfile,
  updateCompanyImage,
  saveCompanyTeamMembers,
  saveCompanyTestimonials,
  saveCompanyGalleryVideos,
  addCompanyGalleryPhoto,
  removeCompanyGalleryPhoto,
} from "@/lib/db/companies";
import { extractCompanyProfileFromUrl, type ExtractCompanyProfileResult } from "@/lib/ai/extract-company-profile";
import { normalizeWebsiteUrl } from "@/lib/url";
import { resizeImageIfNeeded } from "@/lib/image-resize";
import { sniffAttachmentType } from "@/lib/file-sniff";
import { getMyEmployerContext } from "@/lib/db/companies";
import { safeFetch } from "@/lib/safe-fetch";
import { revalidatePath } from "next/cache";

// Security audit finding: every upload path below only ever checked the
// client-declared `file.type` — trivially spoofable (a renamed/relabeled
// file with a malicious payload would sail through). CV uploads already
// go through real magic-byte sniffing (`sniffFileType`); these never did.
// This is the equivalent check for the image types this file accepts —
// returns the real, sniffed content-type (never the client-declared one)
// so what gets stored/served back always matches what the bytes actually
// are, or null if the bytes don't match any allowed image format.
const SNIFFED_TO_MIME: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
function sniffImageContentType(bytes: ArrayBuffer): string | null {
  const sniffed = sniffAttachmentType(new Uint8Array(bytes));
  return sniffed ? (SNIFFED_TO_MIME[sniffed] ?? null) : null;
}

// Real-usage report: an oversized upload was stored and displayed at
// whatever resolution the user picked, relying entirely on CSS object-fit
// to make it "fit" — wasteful at best, visibly wrong at worst. Logos are
// small icons; covers are wide banners; gallery photos are general-purpose
// but still capped well under the 2MB storage-bucket ceiling once resized.
const LOGO_MAX = { width: 512, height: 512 };
const COVER_MAX = { width: 1600, height: 900 };
const GALLERY_MAX = { width: 1920, height: 1080 };
const TEAM_PHOTO_MAX = { width: 256, height: 256 };

function trimmedOrNull(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null;
}

function urlOrNull(formData: FormData, key: string): string | null {
  return normalizeWebsiteUrl(formData.get(key) as string);
}

// Trusts the client's number but still clamps/defaults defensively — this
// is the one place outside the database's own check constraint that could
// catch a malformed value before it round-trips to Postgres and back.
function percentOr50(formData: FormData, key: string): number {
  const raw = Number(formData.get(key));
  if (!Number.isFinite(raw)) return 50;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export async function updateProfileAction(formData: FormData) {
  await updateCompanyProfile({
    company_name: String(formData.get("company_name") ?? "").trim(),
    company_description: trimmedOrNull(formData, "company_description"),
    website: urlOrNull(formData, "website"),
    industry: trimmedOrNull(formData, "industry"),
    company_size: trimmedOrNull(formData, "company_size"),
    company_type: trimmedOrNull(formData, "company_type"),
    facebook_url: urlOrNull(formData, "facebook_url"),
    linkedin_url: urlOrNull(formData, "linkedin_url"),
    instagram_url: urlOrNull(formData, "instagram_url"),
    youtube_url: urlOrNull(formData, "youtube_url"),
    tiktok_url: urlOrNull(formData, "tiktok_url"),
    x_url: urlOrNull(formData, "x_url"),
    location_id: trimmedOrNull(formData, "location_id"),
    address: trimmedOrNull(formData, "address"),
    about_us_text: trimmedOrNull(formData, "about_us_text"),
    how_we_work_text: trimmedOrNull(formData, "how_we_work_text"),
    benefits_text: trimmedOrNull(formData, "benefits_text"),
    custom_section_title: trimmedOrNull(formData, "custom_section_title"),
    custom_section_body: trimmedOrNull(formData, "custom_section_body"),
    cover_position_x: percentOr50(formData, "cover_position_x"),
    cover_position_y: percentOr50(formData, "cover_position_y"),
  });
  revalidatePath("/recruit/company");

  const supabase = await createClient();
  const { data: company } = await supabase.rpc("my_company");
  if (company?.slug) {
    revalidatePath(`/companies/${company.slug}`);
    revalidatePath("/companies");
  }
}

// Must match the `branding` bucket's own limits (supabase/migrations/
// 20260921120200_storage.sql) — checked here too so a bad upload gets a
// specific, translated reason instead of a raw Storage error string.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// Security audit finding: SVG deliberately dropped from this list. Unlike
// PNG/JPEG/WEBP, SVG is XML text with no fixed binary signature — it
// can't be content-sniffed the way the other formats below now are, and
// an SVG can embed a real `<script>` that executes when the file is
// opened directly (new tab, or an `<object>`/`<iframe>` embed), served
// back with the exact content-type it declared. No sanitization library
// is worth adding for a logo/cover upload — PNG/JPEG/WEBP cover every
// real use case here.
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type UploadImageResult =
  | { ok: true }
  | { ok: false; reason: "not_employer" | "file_too_large" | "bad_file" | "upload_failed" };

export async function uploadImageAction(
  field: "logo" | "cover",
  formData: FormData,
): Promise<UploadImageResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: true };

  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "file_too_large" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, reason: "bad_file" };

  const fileBytes = await file.arrayBuffer();
  const sniffedType = sniffImageContentType(fileBytes);
  if (!sniffedType) return { ok: false, reason: "bad_file" };

  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) return { ok: false, reason: "not_employer" };

  const ext = file.name.split(".").pop() || "png";
  const path = `${companyId}/${field}.${ext}`;
  const maxSize = field === "logo" ? LOGO_MAX : COVER_MAX;
  const { bytes, contentType } = await resizeImageIfNeeded(fileBytes, sniffedType, maxSize.width, maxSize.height);

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, bytes, { upsert: true, contentType });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { data: publicUrl } = supabase.storage.from("branding").getPublicUrl(path);

  try {
    await updateCompanyImage(
      field === "logo" ? "company_logo_url" : "cover_image_url",
      // Cache-bust so a re-upload at the same path shows immediately.
      `${publicUrl.publicUrl}?v=${Date.now()}`,
    );
  } catch {
    return { ok: false, reason: "upload_failed" };
  }
  revalidatePath("/recruit/company");
  return { ok: true };
}

export async function saveTeamMembersAction(
  members: { name: string; role: string | null; photoUrl: string | null }[],
) {
  await saveCompanyTeamMembers(members);
  revalidatePath("/recruit/company");

  const supabase = await createClient();
  const { data: company } = await supabase.rpc("my_company");
  if (company?.slug) revalidatePath(`/companies/${company.slug}`);
}

export type UploadTeamPhotoResult = { ok: true; url: string } | { ok: false; reason: "not_employer" | "file_too_large" | "bad_file" | "upload_failed" };

/** Top Employer profile enhancements (real-usage QA item): "team photos".
 *  Returns the uploaded photo's URL rather than writing to a specific
 *  `company_team_members` row — that table is saved delete-then-reinsert
 *  (no stable per-member id across saves, see saveCompanyTeamMembers's
 *  own comment), so the caller holds this URL in its own row of local
 *  state and it's persisted together with name/role on the next
 *  `saveTeamMembersAction` call, exactly like every other field in that
 *  form already works. */
export async function uploadTeamMemberPhotoAction(formData: FormData): Promise<UploadTeamPhotoResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, reason: "bad_file" };

  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "file_too_large" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, reason: "bad_file" };

  const fileBytes = await file.arrayBuffer();
  const sniffedType = sniffImageContentType(fileBytes);
  if (!sniffedType) return { ok: false, reason: "bad_file" };

  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) return { ok: false, reason: "not_employer" };

  const ext = file.name.split(".").pop() || "png";
  const path = `${companyId}/team/${crypto.randomUUID()}.${ext}`;
  const { bytes, contentType } = await resizeImageIfNeeded(
    fileBytes,
    sniffedType,
    TEAM_PHOTO_MAX.width,
    TEAM_PHOTO_MAX.height,
  );

  const { error: uploadError } = await supabase.storage.from("branding").upload(path, bytes, { contentType });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { data: publicUrl } = supabase.storage.from("branding").getPublicUrl(path);
  return { ok: true, url: publicUrl.publicUrl };
}

export async function saveTestimonialsAction(
  testimonials: { name: string; role: string | null; quote: string }[],
) {
  await saveCompanyTestimonials(testimonials);
  revalidatePath("/recruit/company");
}

export async function saveGalleryVideosAction(videos: { title: string; url: string }[]) {
  await saveCompanyGalleryVideos(videos);
  revalidatePath("/recruit/company");
}

export async function uploadGalleryPhotoAction(formData: FormData): Promise<UploadImageResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: true };

  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "file_too_large" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, reason: "bad_file" };

  const fileBytes = await file.arrayBuffer();
  const sniffedType = sniffImageContentType(fileBytes);
  if (!sniffedType) return { ok: false, reason: "bad_file" };

  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) return { ok: false, reason: "not_employer" };

  const ext = file.name.split(".").pop() || "png";
  const path = `${companyId}/gallery/${crypto.randomUUID()}.${ext}`;
  const { bytes, contentType } = await resizeImageIfNeeded(
    fileBytes,
    sniffedType,
    GALLERY_MAX.width,
    GALLERY_MAX.height,
  );

  const { error: uploadError } = await supabase.storage.from("branding").upload(path, bytes, { contentType });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { data: publicUrl } = supabase.storage.from("branding").getPublicUrl(path);

  try {
    await addCompanyGalleryPhoto(publicUrl.publicUrl);
  } catch {
    return { ok: false, reason: "upload_failed" };
  }
  revalidatePath("/recruit/company");
  return { ok: true };
}

export async function removeGalleryPhotoAction(photoId: string) {
  const url = await removeCompanyGalleryPhoto(photoId);
  if (url) {
    const marker = "/public/branding/";
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = url.slice(idx + marker.length).split("?")[0];
      const supabase = await createClient();
      await supabase.storage.from("branding").remove([path]);
    }
  }
  revalidatePath("/recruit/company");
}

/** "Autofill from website" — pure suggestion, no DB write. The console
 *  form prefills from the result and the employer still reviews/edits/
 *  saves normally, same UX as the existing job-URL extraction feature.
 *
 *  Security audit finding: this had no auth check at all, and
 *  `extractCompanyProfileFromUrl` fetches a caller-supplied URL server
 *  side — a fully unauthenticated SSRF + free-compute vector, not just a
 *  missing-permission gap. Gated behind a real employer session now;
 *  `extractCompanyProfileFromUrl` itself is also hardened (safe-fetch.ts)
 *  as defense in depth for the one legitimate caller. */
export async function autofillCompanyProfileAction(url: string): Promise<ExtractCompanyProfileResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "invalid_url" };
  return extractCompanyProfileFromUrl(url);
}

export async function applySuggestedLogoAction(logoUrl: string): Promise<UploadImageResult> {
  // Security audit finding: auth was checked only *after* fetching the
  // caller-supplied URL — the SSRF-capable request already happened by
  // then. Moved to the top, before any network call.
  const supabase = await createClient();
  const { data: companyId } = await supabase.rpc("my_company_id");
  if (!companyId) return { ok: false, reason: "not_employer" };

  let parsed: URL;
  try {
    parsed = new URL(logoUrl);
  } catch {
    return { ok: false, reason: "bad_file" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, reason: "bad_file" };

  let bytes: ArrayBuffer;
  let contentType: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const result = await safeFetch(parsed.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!result.ok || !result.response.ok) return { ok: false, reason: "upload_failed" };

    bytes = await result.response.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, reason: "file_too_large" };
    const sniffed = sniffImageContentType(bytes);
    if (!sniffed) return { ok: false, reason: "bad_file" };
    contentType = sniffed;
  } catch {
    return { ok: false, reason: "upload_failed" };
  }

  const ext = contentType.split("/")[1] || "png";
  const path = `${companyId}/logo.${ext}`;
  const resized = await resizeImageIfNeeded(bytes, contentType, LOGO_MAX.width, LOGO_MAX.height);

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, resized.bytes, { upsert: true, contentType: resized.contentType });
  if (uploadError) return { ok: false, reason: "upload_failed" };

  const { data: publicUrl } = supabase.storage.from("branding").getPublicUrl(path);

  try {
    await updateCompanyImage("company_logo_url", `${publicUrl.publicUrl}?v=${Date.now()}`);
  } catch {
    return { ok: false, reason: "upload_failed" };
  }
  revalidatePath("/recruit/company");
  return { ok: true };
}
