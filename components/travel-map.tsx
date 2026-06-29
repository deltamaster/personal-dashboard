"use client";

import { memo, useMemo, useState } from "react";
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
  type MapRoute,
} from "@/lib/travel-geo";
import type { Flight, ProvinceStat, Train } from "@/lib/types/travel";

const MAINLAND_LOCATIONS = chinaMap.locations.filter(
  (location) => !EMPHASIZED_REGION_IDS.has(location.id)
);
const EMPHASIZED_LOCATIONS = chinaMap.locations.filter((location) =>
  EMPHASIZED_REGION_IDS.has(location.id)
);

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
  };
}

type RouteWithArrow = {
  route: MapRoute;
  arrow: ReturnType<typeof routeArcArrow>;
};

const ChinaRegionLayer = memo(function ChinaRegionLayer({
  countMap,
  maxCount,
  taiwanCount,
}: {
  countMap: Map<string, number>;
  maxCount: number;
  taiwanCount: number;
}) {
  return (
    <g shapeRendering="optimizeSpeed">
      {MAINLAND_LOCATIONS.map((location) => {
        const province = svgLabelToProvince(location.name);
        if (!province) return null;
        const count = countMap.get(province) ?? 0;
        return (
          <path key={location.id} d={location.path} {...regionPathProps(count, maxCount)}>
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

      {EMPHASIZED_LOCATIONS.map((location) => {
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
    </g>
  );
});

function routesWithArrows(routes: MapRoute[]): RouteWithArrow[] {
  return routes.map((route) => ({
    route,
    arrow: routeArcArrow(route.from, route.to, route.bulge),
  }));
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

  const chinaStats = useMemo(
    () => byProvince.filter(({ province }) => CHINA_PROVINCE_NAMES.has(province)),
    [byProvince]
  );
  const countMap = useMemo(
    () => new Map(chinaStats.map(({ province, count }) => [province, count])),
    [chinaStats]
  );
  const maxCount = useMemo(
    () => Math.max(...chinaStats.map((p) => p.count), 1),
    [chinaStats]
  );
  const visited = useMemo(() => chinaStats.filter((p) => p.count > 0), [chinaStats]);
  const taiwanCount = countMap.get("台湾") ?? 0;

  const flightRoutes = useMemo(() => buildFlightRoutes(flights), [flights]);
  const trainRoutes = useMemo(() => buildTrainRoutes(trains), [trains]);
  const visibleTrainRoutes = useMemo(
    () => (showTrains ? routesWithArrows(trainRoutes) : []),
    [showTrains, trainRoutes]
  );
  const visibleFlightRoutes = useMemo(
    () => (showFlights ? routesWithArrows(flightRoutes) : []),
    [showFlights, flightRoutes]
  );
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
        <div className="mx-auto aspect-[774/569] w-full max-w-3xl contain-paint">
          <svg
            viewBox={MAP_VIEW_BOX}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Map of China with visit provinces, flight routes, and train routes"
            onMouseLeave={() => setHoveredEndpoint(null)}
          >
            <defs>
              <clipPath id="travel-map-clip">
                <rect x="0" y="0" width="774" height="569" />
              </clipPath>
            </defs>

            <ChinaRegionLayer
              countMap={countMap}
              maxCount={maxCount}
              taiwanCount={taiwanCount}
            />

            <g clipPath="url(#travel-map-clip)">
              {visibleTrainRoutes.map(({ route, arrow }) => (
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
              ))}

              {visibleFlightRoutes.map(({ route, arrow }) => (
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
              ))}

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
  const padX = 6;
  const padY = 4;
  const fontSize = 10;
  const lineHeight = 14;
  const maxWidth = 140;
  const tooltipX = x + 12;
  let tooltipY = y - 28;
  if (tooltipY < 4) tooltipY = y + 12;
  const boxWidth = Math.min(maxWidth, Math.max(48, label.length * 6 + padX * 2));
  const boxHeight = lineHeight + padY * 2;

  return (
    <g pointerEvents="none" aria-hidden>
      <rect
        x={tooltipX}
        y={tooltipY}
        width={boxWidth}
        height={boxHeight}
        rx={4}
        fill="rgba(15, 20, 25, 0.95)"
        stroke="rgba(255, 255, 255, 0.15)"
      />
      <text
        x={tooltipX + padX}
        y={tooltipY + padY + fontSize}
        fill="white"
        fontSize={fontSize}
      >
        {label.length * 6 > maxWidth - padX * 2 ? `${label.slice(0, 18)}…` : label}
      </text>
    </g>
  );
}
