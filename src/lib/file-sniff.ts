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
