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
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

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
