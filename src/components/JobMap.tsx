"use client";

import { useEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Job } from "@/lib/types";
import "leaflet/dist/leaflet.css";

/**
 * Map view (§8). Coordinates are captured at post time and stored, never
 * geocoded on page load.
 *
 * TILES: OpenStreetMap's community tile server is used here for local
 * development only — its usage policy does not permit a commercial product.
 * Pick a real provider before launch (§8.1, §15.1): MapTiler's free tier, or
 * self-hosted Protomaps.
 *
 * Pins are divIcons carrying the salary, because the salary is the point.
 *
 * The Leaflet map instance is created exactly once and only ever torn down
 * on real unmount — a real-usage QA round (phase 5, search) surfaced a
 * production-only "Cannot read properties of undefined (reading
 * '_leaflet_pos')" crash from the original design, which recreated the
 * whole map from scratch on every `jobs` change (every filter/search).
 * That teardown-and-recreate raced with Leaflet's own internal async/
 * animation-frame bits under real network latency between page
 * transitions — reproduced only against production, never locally with the
 * identical interaction sequence, confirming it was a timing race rather
 * than a logic bug. Markers now live in their own layer group that gets
 * cleared and redrawn on `jobs` changes instead, so the map object itself
 * is only ever created and destroyed once per mount.
 */
export function JobMap({ jobs }: { jobs: Job[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const router = useRouter();
  const format = useFormatter();
  const t = useTranslations("feed");

  // Refs keep the effects below from needing to re-run when these
  // identities change — updated in their own effects rather than during
  // render (mutating a ref mid-render is unsafe under concurrent
  // rendering/Strict Mode double-invocation).
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const labelRef = useRef<(job: Job) => string>(() => "");
  useEffect(() => {
    labelRef.current = (job: Job) =>
      job.salaryMin == null
        ? t("salaryHidden")
        : format.number(job.salaryMin, {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 1,
            notation: "compact",
          });
  }, [format, t]);

  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  async function drawMarkers() {
    const L = (await import("leaflet")).default;
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    markers.clearLayers();
    const pinned = jobsRef.current.filter((j) => j.lat !== null && j.lng !== null);

    for (const job of pinned) {
      const icon = L.divIcon({
        className: "",
        html: `<span class="inline-flex whitespace-nowrap rounded-full bg-[#0C6B58] px-2 py-1 text-[11px] font-bold text-white shadow-sm ring-2 ring-white">${labelRef.current(job)}</span>`,
        iconSize: [0, 0],
        iconAnchor: [22, 12],
      });

      L.marker([job.lat as number, job.lng as number], { icon })
        .addTo(markers)
        .bindPopup(`<strong>${job.title}</strong><br>${job.company.name} — ${job.location}`)
        .on("click", () => routerRef.current.push(`/jobs/${job.slug}`));
    }

    if (pinned.length > 0) {
      map.fitBounds(
        L.latLngBounds(pinned.map((j) => [j.lat as number, j.lng as number])),
        { padding: [48, 48] },
      );
    }
  }

  // Mount effect — creates the map exactly once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      // zoomControl: false + re-added at bottomright — the close button
      // (JobsExplorer, item 3 of a real-usage QA round) now owns the
      // top-left corner Leaflet's zoom control defaults to.
      const map = L.map(containerRef.current, { scrollWheelZoom: true, zoomControl: false }).setView(
        [39.7, -8.3],
        7,
      );
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
      await drawMarkers();
    })();

    return () => {
      cancelled = true;
      markersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Markers effect — redraws pins when the filtered job list changes,
  // without touching the map instance itself.
  useEffect(() => {
    drawMarkers();
  }, [jobs]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-xl" />
      <p className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded bg-white/85 px-2 py-1 text-[10px] text-muted">
        {t("mapHint")}
      </p>
    </div>
  );
}
