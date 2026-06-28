"use client";

import { useMemo, useState } from "react";
import chinaMap from "@svg-maps/china";
import {
  EMPHASIZED_REGION_IDS,
  TAIWAN_GROUP_TRANSFORM,
  TAIWAN_PATH,
} from "@/lib/china-map-extras";
import {
  CHINA_PROVINCE_NAMES,
  svgLabelToProvince,
} from "@/lib/china-provinces";
import {
  MAP_VIEW_BOX,
  buildFlightRoutes,
  buildTrainRoutes,
  collectRouteEndpoints,
} from "@/lib/travel-geo";
import type { Flight, ProvinceStat, Train } from "@/lib/types/travel";

function fillOpacity(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0.12;
  return 0.28 + (count / max) * 0.72;
}

function regionPathProps(count: number, maxCount: number, emphasized = false) {
  const opacity = fillOpacity(count, maxCount);
  return {
    fill: `rgba(29, 155, 240, ${opacity})`,
    stroke: emphasized ? "rgba(15, 20, 25, 0.95)" : "rgba(15, 20, 25, 0.85)",
    strokeWidth: emphasized ? 1.1 : 0.6,
    strokeLinejoin: "round" as const,
    vectorEffect: emphasized ? ("non-scaling-stroke" as const) : undefined,
    className: "transition-[fill] duration-150 hover:brightness-125",
  };
}

export function TravelMap({
  byProvince,
  flights,
  trains,
}: {
  byProvince: ProvinceStat[];
  flights: Flight[];
  trains: Train[];
}) {
  const [showFlights, setShowFlights] = useState(true);
  const [showTrains, setShowTrains] = useState(true);

  const chinaStats = byProvince.filter(({ province }) => CHINA_PROVINCE_NAMES.has(province));
  const countMap = new Map(chinaStats.map(({ province, count }) => [province, count]));
  const maxCount = Math.max(...chinaStats.map((p) => p.count), 1);
  const visited = chinaStats.filter((p) => p.count > 0);
  const taiwanCount = countMap.get("台湾") ?? 0;

  const mainland = chinaMap.locations.filter(
    (location) => !EMPHASIZED_REGION_IDS.has(location.id)
  );
  const emphasized = chinaMap.locations.filter((location) =>
    EMPHASIZED_REGION_IDS.has(location.id)
  );

  const flightRoutes = useMemo(() => buildFlightRoutes(flights), [flights]);
  const trainRoutes = useMemo(() => buildTrainRoutes(trains), [trains]);
  const endpoints = useMemo(
    () =>
      collectRouteEndpoints([
        ...(showFlights ? flightRoutes : []),
        ...(showTrains ? trainRoutes : []),
      ]),
    [flightRoutes, trainRoutes, showFlights, showTrains]
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--muted)]">Travel map</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Provinces visited · flight arcs · rail lines
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowFlights((v) => !v)}
            className={`rounded-full border px-3 py-1 transition-colors ${
              showFlights
                ? "border-sky-500/60 bg-sky-500/15 text-sky-200"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            Flights ({flightRoutes.length})
          </button>
          <button
            type="button"
            onClick={() => setShowTrains((v) => !v)}
            className={`rounded-full border px-3 py-1 transition-colors ${
              showTrains
                ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            Trains ({trainRoutes.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={MAP_VIEW_BOX}
          className="mx-auto h-auto w-full max-w-3xl"
          role="img"
          aria-label="Map of China with visit provinces, flight routes, and train routes"
        >
          <defs>
            <clipPath id="travel-map-clip">
              <rect x="0" y="0" width="774" height="569" />
            </clipPath>
          </defs>

          {mainland.map((location) => {
            const province = svgLabelToProvince(location.name);
            if (!province) return null;
            const count = countMap.get(province) ?? 0;
            return (
              <path
                key={location.id}
                d={location.path}
                {...regionPathProps(count, maxCount)}
              >
                <title>
                  {province}: {count} visit{count === 1 ? "" : "s"}
                </title>
              </path>
            );
          })}

          <g transform={TAIWAN_GROUP_TRANSFORM}>
            <path d={TAIWAN_PATH} {...regionPathProps(taiwanCount, maxCount)}>
              <title>
                台湾: {taiwanCount} visit{taiwanCount === 1 ? "" : "s"}
              </title>
            </path>
          </g>

          {emphasized.map((location) => {
            const province = svgLabelToProvince(location.name);
            if (!province) return null;
            const count = countMap.get(province) ?? 0;
            return (
              <path
                key={location.id}
                d={location.path}
                {...regionPathProps(count, maxCount, true)}
              >
                <title>
                  {province}: {count} visit{count === 1 ? "" : "s"}
                </title>
              </path>
            );
          })}

          <g clipPath="url(#travel-map-clip)">
            {showTrains &&
              trainRoutes.map((route) => (
                <path
                  key={`train-${route.id}`}
                  d={route.path}
                  fill="none"
                  stroke="rgba(251, 191, 36, 0.7)"
                  strokeWidth={1}
                  strokeLinecap="round"
                >
                  <title>
                    {route.label} · {route.count} trip{route.count === 1 ? "" : "s"}
                  </title>
                </path>
              ))}

            {showFlights &&
              flightRoutes.map((route) => (
                <path
                  key={`flight-${route.id}`}
                  d={route.path}
                  fill="none"
                  stroke="rgba(56, 189, 248, 0.75)"
                  strokeWidth={1}
                  strokeLinecap="round"
                >
                  <title>
                    {route.label} · {route.count} flight{route.count === 1 ? "" : "s"}
                  </title>
                </path>
              ))}

            {endpoints.map(([x, y]) => (
              <circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r={1.8}
                fill="rgba(255, 255, 255, 0.95)"
                stroke="rgba(15, 20, 25, 0.85)"
                strokeWidth={0.5}
              />
            ))}
          </g>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded bg-sky-400/80" />
          Flight routes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded bg-amber-400/75" />
          Train routes
        </span>
        <span>{visited.length} provinces visited</span>
      </div>
    </div>
  );
}
