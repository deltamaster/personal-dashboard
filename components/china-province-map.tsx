"use client";

import { CHINA_PROVINCE_TILES } from "@/lib/china-province-tiles";
import type { ProvinceStat } from "@/lib/types/travel";

function fillOpacity(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0.08;
  return 0.2 + (count / max) * 0.75;
}

export function ChinaProvinceMap({ byProvince }: { byProvince: ProvinceStat[] }) {
  const chinaStats = byProvince.filter(({ province }) => province in CHINA_PROVINCE_TILES);
  const countMap = new Map(chinaStats.map(({ province, count }) => [province, count]));
  const maxCount = Math.max(...chinaStats.map((p) => p.count), 1);
  const visited = chinaStats.filter((p) => p.count > 0);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--muted)]">China provinces visited</h3>
          <p className="mt-1 text-2xl font-bold">{visited.length}</p>
        </div>
        <p className="text-xs text-[var(--muted)]">Darker = more visits</p>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 900 620"
          className="mx-auto h-auto w-full max-w-3xl"
          role="img"
          aria-label="Map of China provinces colored by visit count"
        >
          {Object.entries(CHINA_PROVINCE_TILES).map(([province, { x, y, w, h }]) => {
            const count = countMap.get(province) ?? 0;
            const opacity = fillOpacity(count, maxCount);
            return (
              <g key={province}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={4}
                  fill={`rgba(29, 155, 240, ${opacity})`}
                  stroke="var(--border)"
                  strokeWidth={1}
                >
                  <title>
                    {province}: {count} visit{count === 1 ? "" : "s"}
                  </title>
                </rect>
                {w >= 40 && h >= 35 && (
                  <text
                    x={x + w / 2}
                    y={y + h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none select-none fill-[var(--foreground)]"
                    fontSize={Math.min(11, w / 4)}
                    opacity={count > 0 ? 0.95 : 0.35}
                  >
                    {province.length > 3 ? province.slice(0, 2) : province}
                  </text>
                )}
              </g>
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
