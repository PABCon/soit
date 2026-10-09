import { describe, expect, it } from "vitest";
import { getVideoEmbedUrl } from "./video-embed";

describe("getVideoEmbedUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"],
  ])("%s -> %s", (input, expected) => {
    expect(getVideoEmbedUrl(input)).toBe(expected);
  });

  it.each([
    "https://example.com/video.mp4",
    "https://vimeo.com/not-a-number",
    "not a url at all",
  ])("returns null for %s", (input) => {
    expect(getVideoEmbedUrl(input)).toBeNull();
  });
});
