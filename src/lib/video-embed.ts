/**
 * Top Employer profile enhancements (real-usage QA item): "playable
 * video embeds" — the gallery-video link just opened YouTube/Vimeo in a
 * new tab before this. Recognizes the common URL shapes for both
 * providers and returns their respective embed-player URL; returns null
 * for anything else (a direct .mp4 link, an unrecognized host) so the
 * caller can fall back to the plain external link rather than rendering
 * a broken iframe.
 */
export function getVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.pathname === "/watch" ? parsed.searchParams.get("v") : parsed.pathname.split("/").pop();
      if (parsed.pathname.startsWith("/embed/")) return `https://www.youtube.com/embed/${parsed.pathname.split("/")[2]}`;
      if (parsed.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${parsed.pathname.split("/")[2]}`;
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}
