"use client";

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
import type { ProvinceStat } from "@/lib/types/travel";

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

export function ChinaProvinceMap({ byProvince }: { byProvince: ProvinceStat[] }) {
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

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--muted)]">China provinces visited</h3>
          <p className="mt-1 text-2xl font-bold">{visited.length}</p>
        </div>
        <p className="text-xs text-[var(--muted)]">Darker blue = more visits</p>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={chinaMap.viewBox}
          className="mx-auto h-auto w-full max-w-3xl"
          role="img"
          aria-label="Map of China provinces colored by visit count"
        >
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
        </svg>
      </div>

      {visited.length > 0 && (
        <ul className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {visited.slice(0, 12).map(({ province, count }) => (
            <li key={province} className="flex justify-between text-sm">
              <span>{province}</span>
              <span className="text-[var(--muted)]">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
