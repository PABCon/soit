/**
 * File type by magic bytes, never by client-declared MIME type or
 * extension (§6.7). PDF: `%PDF-`. DOCX: a ZIP archive (`PK\x03\x04`) — the
 * OOXML container format; a plain ZIP-signature check is sufficient here
 * since the allowlist itself (§6.7) already limits what's accepted.
 */
export type SniffedType = "pdf" | "docx" | null;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, i) => bytes[i] === byte);
}

export function sniffFileType(bytes: Uint8Array): SniffedType {
  if (startsWith(bytes, PDF_MAGIC)) return "pdf";
  if (startsWith(bytes, ZIP_MAGIC)) return "docx";
  return null;
}

/**
 * Round 31 — message attachments accept a wider set than a CV (the same
 * pdf/docx, plus the image types `avatars`/`branding` already allow), so
 * this is a separate function rather than widening `sniffFileType` itself
 * — every existing `sniffFileType` caller (CV upload) assumes a two-way
 * pdf/docx result, and silently returning an image kind there would be a
 * real behavior change, not an additive one.
 */
export type SniffedAttachmentType = "pdf" | "docx" | "png" | "jpeg" | "webp" | null;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function isWebp(bytes: Uint8Array): boolean {
  // RIFF container: "RIFF" (0-3), 4 bytes of size, "WEBP" (8-11).
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  return riff === "RIFF" && webp === "WEBP";
}

export function sniffAttachmentType(bytes: Uint8Array): SniffedAttachmentType {
  if (startsWith(bytes, PDF_MAGIC)) return "pdf";
  if (startsWith(bytes, PNG_MAGIC)) return "png";
  if (startsWith(bytes, JPEG_MAGIC)) return "jpeg";
  if (isWebp(bytes)) return "webp";
  if (startsWith(bytes, ZIP_MAGIC)) return "docx";
  return null;
}
