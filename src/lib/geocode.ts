/**
 * Geocode once at post time, store the result, never geocode on page load
 * (§8). Nominatim's public instance: free, max 1 req/sec, requires an
 * identifying User-Agent — our volume is one call per job posted, well
 * inside policy. A miss or a network error returns null; it never blocks
 * saving the job (§14 step 4 — only salary/employment-type are mandatory).
 */
export async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  const query = `${location}, Portugal`;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pt&q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "SoIT-JobBoard/1.0 (+https://soit.vercel.app)" } },
    );
    if (!res.ok) return null;

    const results: Array<{ lat: string; lon: string }> = await res.json();
    const first = results[0];
    if (!first) return null;

    return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
  } catch {
    return null;
  }
}
