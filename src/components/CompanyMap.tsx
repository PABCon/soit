"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * A single, static pin — the company's chosen city centroid (§ real-usage
 * QA, employer-console review item 5). Adapted from `JobMap.tsx`'s own
 * mount-effect/markers-effect split: even though this map only ever shows
 * one fixed point (no filter/search state to react to), that split exists
 * specifically to avoid a real production Leaflet crash from recreating the
 * whole map instance on every re-render, so it's kept here too rather than
 * risking the same class of bug for a "simpler" single-effect version.
 */
export function CompanyMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: false }).setView(
        [latitude, longitude],
        13,
      );
      L.control.zoom({ position: "bottomright" }).addTo(map);
      // Real MapTiler tiles — same "basic-v2" style as JobMap.tsx (§8.1,
      // chosen for the calm/light/blue-accent look, see that file's own
      // comment for how the style was picked), replacing the dev-only
      // OpenStreetMap community tile server this map used before.
      L.tileLayer(
        `https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
        {
          maxZoom: 20,
          detectRetina: true,
          attribution:
            '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
        },
      ).addTo(map);

      // A divIcon, not Leaflet's default L.marker icon — the default's
      // marker-icon.png/marker-shadow.png resolve relative to the current
      // page URL under Turbopack/webpack bundling, not Leaflet's own asset
      // path, and 404 (confirmed directly, not assumed). JobMap.tsx already
      // sidesteps this the same way, for the same reason.
      const icon = L.divIcon({
        className: "",
        html: '<span class="block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#0C6B58] shadow-sm"></span>',
        iconSize: [0, 0],
      });
      L.marker([latitude, longitude], { icon }).addTo(map);

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude]);

  return <div ref={containerRef} className="h-64 w-full rounded-xl" />;
}
