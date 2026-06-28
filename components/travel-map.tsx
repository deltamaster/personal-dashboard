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
  routeArcArrow,
  type MapEndpoint,
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
  const [hoveredEndpoint, setHoveredEndpoint] = useState<MapEndpoint | null>(null);

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
          onMouseLeave={() => setHoveredEndpoint(null)}
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
              trainRoutes.map((route) => {
                const arrow = routeArcArrow(route.from, route.to, route.bulge);
                return (
                  <g key={`train-${route.id}`}>
                    <path
                      d={route.path}
                      fill="none"
                      stroke="rgba(251, 191, 36, 0.7)"
                      strokeWidth={1}
                      strokeLinecap="round"
                    >
                      <title>
                        {route.fromKey} → {route.toKey} · {route.label} · {route.count}{" "}
                        trip{route.count === 1 ? "" : "s"}
                      </title>
                    </path>
                    <g
                      transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.angle})`}
                      pointerEvents="none"
                      aria-hidden
                    >
                      <path
                        d="M -4 -2.5 L 4 0 L -4 2.5 Z"
                        fill="rgba(251, 191, 36, 0.85)"
                      />
                    </g>
                  </g>
                );
              })}

            {showFlights &&
              flightRoutes.map((route) => {
                const arrow = routeArcArrow(route.from, route.to, route.bulge);
                return (
                  <g key={`flight-${route.id}`}>
                    <path
                      d={route.path}
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.75)"
                      strokeWidth={1}
                      strokeLinecap="round"
                    >
                      <title>
                        {route.fromKey} → {route.toKey} · {route.label} · {route.count}{" "}
                        flight{route.count === 1 ? "" : "s"}
                      </title>
                    </path>
                    <g
                      transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.angle})`}
                      pointerEvents="none"
                      aria-hidden
                    >
                      <path
                        d="M -6 -3.75 L 6 0 L -6 3.75 Z"
                        fill="rgba(56, 189, 248, 0.9)"
                      />
                    </g>
                  </g>
                );
              })}

            {endpoints.map((endpoint) => {
              const [x, y] = endpoint.point;
              const label = endpoint.names.join(" · ");
              const active =
                hoveredEndpoint?.point[0] === x && hoveredEndpoint?.point[1] === y;
              return (
                <g key={`${x}-${y}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={10}
                    fill="#ffffff"
                    fillOpacity={0.001}
                    className="cursor-help"
                    aria-label={label}
                    onMouseEnter={() => setHoveredEndpoint(endpoint)}
                    onFocus={() => setHoveredEndpoint(endpoint)}
                    onBlur={() => setHoveredEndpoint(null)}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? 2.4 : 1.8}
                    fill="rgba(255, 255, 255, 0.95)"
                    stroke="rgba(15, 20, 25, 0.85)"
                    strokeWidth={0.5}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </g>

          {hoveredEndpoint && (
            <MapEndpointTooltip
              x={hoveredEndpoint.point[0]}
              y={hoveredEndpoint.point[1]}
              label={hoveredEndpoint.names.join(" · ")}
            />
          )}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center">
            <span className="inline-block h-0.5 w-4 rounded bg-sky-400/80" />
            <span
              className="inline-block h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-sky-400/95"
              aria-hidden
            />
          </span>
          Flight routes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center">
            <span className="inline-block h-0.5 w-4 rounded bg-amber-400/75" />
            <span
              className="inline-block h-0 w-0 border-y-[3px] border-l-[5px] border-y-transparent border-l-amber-400/85"
              aria-hidden
            />
          </span>
          Train routes
        </span>
        <span>{visited.length} provinces visited</span>
      </div>
    </div>
  );
}

function MapEndpointTooltip({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  const padY = 5;
  const lineHeight = 16;
  const maxWidth = 140;
  const tooltipX = x + 12;
  let tooltipY = y - 28;
  if (tooltipY < 4) tooltipY = y + 12;

  return (
    <g pointerEvents="none" aria-hidden>
      <foreignObject
        x={tooltipX}
        y={tooltipY}
        width={maxWidth}
        height={lineHeight + padY * 2}
        className="overflow-visible"
      >
        <div className="w-max max-w-[140px] rounded-md border border-white/15 bg-[#0f1419]/95 px-2 py-1 text-xs leading-4 text-white shadow-lg">
          {label}
        </div>
      </foreignObject>
    </g>
  );
}
