"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { CompanyLogo } from "@/components/CompanyLogo";
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
 * A single-job point renders exactly as before (Leaflet's own default
 * popup bubble + click-to-navigate). A 2+ point renders a count-badge
 * marker; clicking it opens a real React-rendered panel docked to the
 * map's own top-right corner (`activeGroup` state below) — a reference
 * image comparison round found Leaflet's default speech-bubble popup
 * chrome (rounded white bubble + pointer tail, anchored to the marker)
 * didn't match the "clean docked card" look the reference actually wants,
 * so this is a real overlay div, not `L.popup()` — which also means the
 * row list can use real `CompanyLogo`/`Link` components instead of the
 * raw HTML strings a Leaflet popup would otherwise require.
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

  // The docked "N jobs in this area" panel — a real React overlay, not a
  // Leaflet popup (see the file's own doc comment for why). `null` means
  // closed.
  const [activeGroup, setActiveGroup] = useState<Job[] | null>(null);

  // Refs keep the effects below from needing to re-run when these
  // identities change — updated in their own effects rather than during
  // render (mutating a ref mid-render is unsafe under concurrent
  // rendering/Strict Mode double-invocation).
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Plain render-time helper for the docked panel's JSX below (real React
  // render, safe to call `t`/`format` directly) — kept separate from
  // `labelRef`, which exists only for the imperative Leaflet callbacks in
  // `drawMarkers()`, outside React's own render pass.
  function salaryLabel(job: Job): string {
    return job.salaryMin == null
      ? t("salaryHidden")
      : format.number(job.salaryMin, {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 1,
          notation: "compact",
        });
  }

  const labelRef = useRef<(job: Job) => string>(() => "");
  useEffect(() => {
    labelRef.current = salaryLabel;
  });

  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  async function drawMarkers() {
    const L = (await import("leaflet")).default;
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    // Jobs changed out from under any open panel (a new filter/search) —
    // its job list could be stale, so close it rather than risk a link
    // pointing at a job that's no longer even on the map.
    setActiveGroup(null);

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

      // 2+ jobs stacked on the same point — a count-badge marker that
      // opens the docked panel (React state, not a Leaflet popup) instead
      // of silently hiding all but one.
      const icon = L.divIcon({
        className: "",
        html: `<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0C6B58] text-xs font-bold text-white shadow-sm ring-2 ring-white">${group.length}</span>`,
        iconSize: [0, 0],
        iconAnchor: [14, 14],
      });

      L.marker([lat, lng], { icon }).addTo(markers).on("click", () => setActiveGroup(group));
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

      {activeGroup && (
        <div className="absolute top-4 right-4 z-[1150] flex max-h-[calc(100%-2rem)] w-[340px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">{t("jobsInThisArea", { count: activeGroup.length })}</p>
            <button
              type="button"
              onClick={() => setActiveGroup(null)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              <span className="sr-only">{t("hideMap")}</span>
            </button>
          </div>

          <ul className="overflow-y-auto">
            {activeGroup.map((job) => (
              <li key={job.slug} className="border-b border-line last:border-0">
                <Link
                  href={`/jobs/${job.slug}`}
                  onClick={() => setActiveGroup(null)}
                  className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-subtle"
                >
                  <CompanyLogo company={job.company} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                    <p className="truncate text-xs text-muted">
                      {job.company.name} · {job.location ?? t("remote")} · {t(`workModel.${job.workModel}`)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-pine">{salaryLabel(job)}</p>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-muted"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
