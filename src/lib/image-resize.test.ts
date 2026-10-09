import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { resizeImageIfNeeded } from "./image-resize";

async function makeTestPng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } } })
    .png()
    .toBuffer();
}

describe("resizeImageIfNeeded", () => {
  it("shrinks an oversized image down to fit within the max box", async () => {
    const big = await makeTestPng(3000, 2000);
    const result = await resizeImageIfNeeded(big, "image/png", 512, 512);
    const meta = await sharp(result.bytes).metadata();
    expect(meta.width).toBeLessThanOrEqual(512);
    expect(meta.height).toBeLessThanOrEqual(512);
    // Aspect ratio preserved (3:2).
    expect(meta.width! / meta.height!).toBeCloseTo(3000 / 2000, 1);
  });

  it("never upscales an image already smaller than the max box", async () => {
    const small = await makeTestPng(100, 80);
    const result = await resizeImageIfNeeded(small, "image/png", 512, 512);
    const meta = await sharp(result.bytes).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(80);
  });

  it("leaves SVG untouched — already infinitely scalable, never rasterized", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    const result = await resizeImageIfNeeded(svg, "image/svg+xml", 512, 512);
    expect(result.bytes.toString()).toBe(svg.toString());
    expect(result.contentType).toBe("image/svg+xml");
  });

  it("preserves the original content type when resizing", async () => {
    const big = await makeTestPng(3000, 2000);
    const result = await resizeImageIfNeeded(big, "image/png", 512, 512);
    expect(result.contentType).toBe("image/png");
  });
});
