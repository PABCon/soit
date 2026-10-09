const EARTH_RADIUS_KM = 6371;

/** Great-circle distance — shared by the "near X within Y km" client-side
 *  job search (JobsExplorer) and the saved-search notification matcher
 *  (saved-search-digest cron), so both ever define "near" the same way.
 *  No geocoding provider: every job's own lat/lng and every curated
 *  location's lat/lng are already stored, so this is just arithmetic over
 *  data already in hand. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
