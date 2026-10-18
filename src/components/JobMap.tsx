"use client";

import { useEffect, useRef } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Job } from "@/lib/types";
import "leaflet/dist/leaflet.css";

/**
 * Map view (§8). Coordinates are captured at post time and stored, never
 * geocoded on page load.
 *
 * TILES: real MapTiler tiles (§8.1/§15.1 — replaces the OpenStreetMap
 * community tile server, which was dev-only, never licensed for this).
 * Style: "basic-v2" — chosen by comparing it against MapTiler's other
 * named styles (bright-v2, streets-v2, topo-v2, dataviz) rendered side by
 * side over a real Lisbon tile; basic-v2 is the one that's actually calm
 * and light (pale palette, no saturated yellow/orange roads) — a match
 * for the design system's own light, blue-accent language, not just the
 * cheapest default. The API key is restricted to justit.pt/www.justit.pt
 * via MapTiler's own origin-restriction feature (configured on the
 * account, not in code), which is why it's safe as a public env var.
 *
 * Pins are divIcons carrying the salary, because the salary is the point.
 *
 * MULTIPLE JOBS, ONE POINT: location is per-city, not per-address, so
 * several jobs in the same city share the exact same lat/lng (the city's
 * centroid) — stacked exactly on top of each other, only one ever visible/
 * clickable. Jobs are grouped by coordinate (rounded to 4 decimals, ~11m)
 * before rendering — deliberately not a real clustering library
 * (Leaflet.markercluster etc.): the root cause here is literally identical
 * coordinates at a handful of job count, not visual crowding that shifts
 * with zoom level, so a simple "same point → one marker" grouping is both
 * simpler and more directly correct than zoom-aware distance clustering.
 * A single-job point renders exactly as before; a 2+ point renders a
 * count-badge marker whose popup lists every job there (title/company/
 * salary, each a real link) — built as raw HTML/Tailwind matching
 * `CompactJobRow`'s visual recipe (Leaflet popups are plain DOM, not
 * React, so the component itself can't be mounted directly), with clicks
 * on the popup's job links intercepted to use the same client-side router
 * navigation the existing single-job marker click already uses.
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
  const locale = useLocale();

  // Refs keep the effects below from needing to re-run when these
  // identities change — updated in their own effects rather than during
  // render (mutating a ref mid-render is unsafe under concurrent
  // rendering/Strict Mode double-invocation).
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

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

  // Builds one <a> row inside a multi-job marker's popup, mirroring
  // CompactJobRow.tsx's own visual recipe (title / company · location ·
  // work model / salary) as raw HTML — a Leaflet popup is plain DOM, not a
  // React tree, so the real component can't be mounted into it directly.
  const popupRowRef = useRef<(job: Job) => string>(() => "");
  useEffect(() => {
    popupRowRef.current = (job: Job) => `
      <a href="/${localeRef.current}/jobs/${job.slug}" data-slug="${job.slug}" class="map-job-link block border-b border-line py-2 last:border-0 hover:bg-subtle">
        <p class="truncate text-sm font-semibold text-ink">${job.title}</p>
        <p class="truncate text-xs text-muted">${job.company.name} · ${job.location ?? t("remote")} · ${t(`workModel.${job.workModel}`)}</p>
        <p class="mt-0.5 text-xs font-semibold text-[#0C6B58]">${labelRef.current(job)}</p>
      </a>`;
  }, [t]);

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

    // Group by (near-)identical coordinate — see the file's own doc
    // comment for why this is a simple rounding grouping rather than a
    // real clustering library.
    const groups = new Map<string, Job[]>();
    for (const job of pinned) {
      const key = `${(job.lat as number).toFixed(4)},${(job.lng as number).toFixed(4)}`;
      const group = groups.get(key);
      if (group) group.push(job);
      else groups.set(key, [job]);
    }

    for (const group of groups.values()) {
      const [lat, lng] = [group[0].lat as number, group[0].lng as number];

      if (group.length === 1) {
        const job = group[0];
        const icon = L.divIcon({
          className: "",
          html: `<span class="inline-flex whitespace-nowrap rounded-full bg-[#0C6B58] px-2 py-1 text-[11px] font-bold text-white shadow-sm ring-2 ring-white">${labelRef.current(job)}</span>`,
          iconSize: [0, 0],
          iconAnchor: [22, 12],
        });

        L.marker([lat, lng], { icon })
          .addTo(markers)
          .bindPopup(`<strong>${job.title}</strong><br>${job.company.name} — ${job.location}`)
          .on("click", () => routerRef.current.push(`/jobs/${job.slug}`));
        continue;
      }

      // 2+ jobs stacked on the same point — a count-badge marker whose
      // popup lists every job there instead of silently hiding all but
      // one. No "navigate on click" handler here (unlike the single-job
      // case above) — clicking just opens the popup, same as Leaflet's
      // own default marker behavior, so the visitor can pick one.
      const icon = L.divIcon({
        className: "",
        html: `<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0C6B58] text-xs font-bold text-white shadow-sm ring-2 ring-white">${group.length}</span>`,
        iconSize: [0, 0],
        iconAnchor: [14, 14],
      });

      const popupHtml = `<div class="max-h-72 w-64 overflow-y-auto">${group
        .map((job) => popupRowRef.current(job))
        .join("")}</div>`;

      const marker = L.marker([lat, lng], { icon })
        .addTo(markers)
        .bindPopup(popupHtml, { maxWidth: 280 });

      marker.on("popupopen", (e) => {
        const container = e.popup.getElement();
        container?.querySelectorAll<HTMLAnchorElement>(".map-job-link").forEach((a) => {
          a.addEventListener("click", (ev) => {
            ev.preventDefault();
            const slug = a.dataset.slug;
            if (slug) {
              marker.closePopup();
              routerRef.current.push(`/jobs/${slug}`);
            }
          });
        });
      });
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
      L.tileLayer(
        `https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
        {
          maxZoom: 20,
          // `{r}` resolves to "@2x" on a retina display, "" otherwise —
          // Leaflet's own built-in mechanism, requires detectRetina.
          detectRetina: true,
          attribution:
            '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
        },
      ).addTo(map);

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
      <div ref={containerRef} className="h-full w-full rounded-[10px]" />
      <p className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded bg-white/85 px-2 py-1 text-[10px] text-muted">
        {t("mapHint")}
      </p>
    </div>
  );
}
