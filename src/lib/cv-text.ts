import { getDocumentProxy, extractText } from "unpdf";
import mammoth from "mammoth";
import type { SniffedType } from "@/lib/file-sniff";

/** Plain-text extraction for the CV-autofill LLM prompt (§AI Pieces
 *  backlog, phase 2) — `unpdf` (WASM-based pdf.js build, no native binary,
 *  safe on Vercel serverless) for PDF, `mammoth` for DOCX. Returns null on
 *  anything unparseable rather than throwing, so the caller can report a
 *  clean `bad_file` result the same way a failed magic-byte sniff already does. */
export async function extractCvText(bytes: Uint8Array, kind: SniffedType): Promise<string | null> {
  try {
    if (kind === "pdf") {
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    }
    if (kind === "docx") {
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return value;
    }
  } catch {
    return null;
  }
  return null;
}
