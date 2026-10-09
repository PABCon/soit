import sharp from "sharp";

/**
 * Real-usage report: oversized uploads (logo, cover, gallery, avatars)
 * were stored and displayed at whatever resolution the user happened to
 * upload, relying entirely on CSS `object-fit` to make them "fit" visually
 * — wasteful bandwidth at best, visibly wrong at worst. Resizes down-only
 * (never upscales a small image) to fit within a context-appropriate box,
 * preserving aspect ratio. SVG is deliberately skipped — it's already
 * infinitely scalable, and rasterizing it would be a real regression for
 * a vector logo.
 */
export async function resizeImageIfNeeded(
  bytes: ArrayBuffer | Buffer,
  contentType: string,
  maxWidth: number,
  maxHeight: number,
): Promise<{ bytes: Buffer; contentType: string }> {
  const input = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

  if (contentType === "image/svg+xml") {
    return { bytes: input, contentType };
  }

  const resized = await sharp(input)
    .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: true })
    .toBuffer();
  return { bytes: resized, contentType };
}
