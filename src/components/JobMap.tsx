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
 */
export function JobMap({ jobs }: { jobs: Job[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const format = useFormatter();
  const t = useTranslations("feed");

  // Refs keep the effect from re-running when these identities change.
  const routerRef = useRef(router);
  routerRef.current = router;
  const labelRef = useRef<(job: Job) => string>(() => "");
  labelRef.current = (job: Job) =>
    format.number(job.salaryMin, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 1,
      notation: "compact",
    });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let map: import("leaflet").Map | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const pinned = jobs.filter((j) => j.lat !== null && j.lng !== null);

      map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
        [39.7, -8.3],
        7,
      );

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      for (const job of pinned) {
        const icon = L.divIcon({
          className: "",
          html: `<span class="inline-flex whitespace-nowrap rounded-full bg-[#0C6B58] px-2 py-1 text-[11px] font-bold text-white shadow-sm ring-2 ring-white">${labelRef.current(job)}</span>`,
          iconSize: [0, 0],
          iconAnchor: [22, 12],
        });

        L.marker([job.lat as number, job.lng as number], { icon })
          .addTo(map)
          .bindPopup(
            `<strong>${job.title}</strong><br>${job.company.name} — ${job.location}`,
          )
          .on("click", () => routerRef.current.push(`/jobs/${job.slug}`));
      }

      if (pinned.length > 0) {
        map.fitBounds(
          L.latLngBounds(pinned.map((j) => [j.lat as number, j.lng as number])),
          { padding: [48, 48] },
        );
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
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
