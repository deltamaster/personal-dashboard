"use client";

import type { Holding, PortfolioStats, Snapshot } from "@/lib/types/portfolio";
import { buildNavHistoryPoints, formatMoney, formatMoneyCompact, type NavHistoryPoint } from "@/lib/portfolio-format";

const RISK_COLORS: Record<number, string> = {
  1: "#22c55e",
  2: "#3b82f6",
  3: "#eab308",
  4: "#f97316",
  5: "#ef4444",
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  fund: "Fund",
  stock: "Stock",
  structured_deposit: "Structured",
  bond: "Bond",
  etf: "ETF",
  other: "Other",
};

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = dateStr.slice(0, 10);
  return d;
}

function DonutChart({
  title,
  segments,
  total,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  if (segments.length === 0 || total <= 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">{title}</h3>
        <p className="text-sm text-[var(--muted)]">No data yet</p>
      </div>
    );
  }

  let gradient = "conic-gradient(";
  let cumulative = 0;
  const stops: string[] = [];

  for (const segment of segments) {
    const pct = (segment.value / total) * 100;
    stops.push(`${segment.color} ${cumulative}% ${cumulative + pct}%`);
    cumulative += pct;
  }
  gradient += stops.join(", ") + ")";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">{title}</h3>
      <div className="flex items-center gap-4">
        <div
          className="h-24 w-24 shrink-0 rounded-full"
          style={{ background: gradient }}
          title={title}
        />
        <ul className="min-w-0 flex-1 space-y-1.5">
          {segments.slice(0, 6).map((segment) => (
            <li key={segment.label} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: segment.color }}
              />
              <span className="truncate">{segment.label}</span>
              <span className="ml-auto shrink-0 text-[var(--muted)]">
                {((segment.value / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const DONUT_COLORS = [
  "#1d9bf0",
  "#7856ff",
  "#f91880",
  "#00ba7c",
  "#ff7a00",
  "#ffd400",
  "#8b949e",
];

const CHART_BAR_HEIGHT_PX = 96;

function NavHistoryLineChart({ points }: { points: NavHistoryPoint[] }) {
  const chartHeight = CHART_BAR_HEIGHT_PX;
  const chartWidth = 320;
  const padding = { top: 14, right: 12, bottom: 14, left: 44 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const lastIndex = values.length - 1;

  const plotPoints = values.map((value, index) => {
    const x =
      padding.left + (lastIndex === 0 ? plotWidth / 2 : (index / lastIndex) * plotWidth);
    const y = padding.top + plotHeight - ((value - minValue) / range) * plotHeight;
    return {
      x,
      y,
      date: points[index].date,
      value,
    };
  });

  const linePoints = plotPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = [
    `M ${plotPoints[0].x} ${padding.top + plotHeight}`,
    ...plotPoints.map((point) => `L ${point.x} ${point.y}`),
    `L ${plotPoints[lastIndex].x} ${padding.top + plotHeight}`,
    "Z",
  ].join(" ");

  return (
    <div className="aspect-[320/112] w-full">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="NAV history line chart"
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + plotHeight * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={padding.left + plotWidth}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
            />
          );
        })}
        <text
          x={padding.left - 6}
          y={padding.top + 4}
          fill="var(--muted)"
          fontSize="9"
          textAnchor="end"
        >
          {formatMoneyCompact(maxValue)}
        </text>
        <text
          x={padding.left - 6}
          y={padding.top + plotHeight}
          fill="var(--muted)"
          fontSize="9"
          textAnchor="end"
        >
          {formatMoneyCompact(minValue)}
        </text>
        <path d={areaPath} fill="color-mix(in srgb, var(--accent) 18%, transparent)" />
        <polyline
          points={linePoints}
          fill="none"
          stroke="#1d9bf0"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {plotPoints.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="3.5" fill="#1d9bf0">
            <title>{`${point.date}: ${formatMoney(point.value)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export function PortfolioStatsPanel({
  stats,
  snapshots,
}: {
  stats: PortfolioStats;
  snapshots: Snapshot[];
}) {
  const maxRiskValue = Math.max(...stats.byRiskLevel.map((r) => r.value), 1);
  const hasStale = stats.staleHoldingIds.length > 0;

  const bankSegments = stats.byBank
    .filter((b) => b.value > 0)
    .map((b, i) => ({
      label: b.label,
      value: b.value,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));

  const assetSegments = stats.byAssetType
    .filter((a) => a.value > 0)
    .map((a, i) => ({
      label: ASSET_TYPE_LABELS[a.label] ?? a.label,
      value: a.value,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));

  const navHistoryPoints = buildNavHistoryPoints(snapshots, stats.totalValue);

  return (
    <div className="space-y-6">
      {hasStale && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
          {stats.staleHoldingIds.length} holding
          {stats.staleHoldingIds.length === 1 ? "" : "s"} need valuation updates
          (R4/R5 &gt; 30 days, R3 &gt; 90 days since last update).
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--muted)]">Total NAV</p>
          <p className="mt-1 text-3xl font-bold">{formatMoney(stats.totalValue)}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {stats.holdingCount} holdings
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--muted)]">Unrealized P&amp;L</p>
          <p
            className={`mt-1 text-3xl font-bold ${
              stats.totalPnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {formatMoney(stats.totalPnl)}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Dividends {formatMoney(stats.totalDividend)}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--muted)]">Total return</p>
          <p
            className={`mt-1 text-3xl font-bold ${
              stats.totalReturn >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {formatMoney(stats.totalReturn)}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">Including dividends</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--muted)]">Defensive ratio</p>
          <p className="mt-1 text-3xl font-bold">
            {(stats.defensiveRatio * 100).toFixed(1)}%
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">R1 + R2 allocation</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-4 shrink-0 text-sm font-medium text-[var(--muted)]">
            Risk level (R1–R5) by value
          </h3>
          <div className="flex gap-2 pt-1">
            {stats.byRiskLevel.map(({ level, value, count }) => (
              <div
                key={level}
                className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-1"
              >
                <div
                  className="flex h-24 w-full items-end overflow-hidden rounded-sm bg-[var(--background)]/40"
                >
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${Math.max(
                        value > 0 ? 4 : 0,
                        Math.round((value / maxRiskValue) * CHART_BAR_HEIGHT_PX)
                      )}px`,
                      background: RISK_COLORS[level],
                    }}
                    title={`R${level}: ${formatMoney(value)} (${count})`}
                  />
                </div>
                <span className="text-[10px] text-[var(--muted)]">R{level}</span>
                {count > 0 && (
                  <span className="text-[10px] text-[var(--muted)]">{count}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {navHistoryPoints.length > 1 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">NAV history</h3>
            <NavHistoryLineChart points={navHistoryPoints} />
            <p className="mt-2 text-xs text-[var(--muted)]">
              {navHistoryPoints[0]?.date} → {navHistoryPoints[navHistoryPoints.length - 1]?.date}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <DonutChart
          title="By bank"
          segments={bankSegments}
          total={stats.totalValue}
        />
        <DonutChart
          title="By asset class"
          segments={assetSegments}
          total={stats.totalValue}
        />
      </div>
    </div>
  );
}

export function HoldingsTable({
  holdings,
  staleHoldingIds,
}: {
  holdings: Holding[];
  staleHoldingIds: string[];
}) {
  const staleSet = new Set(staleHoldingIds);

  if (holdings.length === 0) {
    return <p className="text-[var(--muted)]">No holdings yet.</p>;
  }

  const headerGrid =
    "md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 md:gap-x-3 md:gap-y-1 md:items-center";
  const rowGrid =
    "md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 md:gap-x-3 md:gap-y-2 md:items-center";
  const secondaryMeta =
    "text-xs text-[var(--muted)] xl:text-sm xl:text-[var(--muted)]";

  return (
    <div className="rounded-xl border border-[var(--border)] text-sm">
      <div
        className={`hidden border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--muted)] ${headerGrid}`}
      >
        <span className="font-medium">Name</span>
        <span className="font-medium text-right">Value</span>
        <span className="font-medium">Risk</span>
        <span className="font-medium text-right">P&amp;L</span>
        <span className="hidden font-medium lg:block">Type</span>
        <span className="hidden font-medium xl:block">Bank</span>
        <span className="hidden font-medium text-right xl:block">Updated</span>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {holdings.map((holding) => {
          const stale = staleSet.has(holding.holding_id);
          const currency = holding.currency ?? "CNY";
          const value = holding.current_value ?? 0;
          const pnlPct = holding.unrealized_pct ?? 0;
          const risk = holding.risk_level;
          const typeLabel =
            ASSET_TYPE_LABELS[holding.asset_type ?? ""] ??
            holding.asset_type ??
            "—";
          const bankLabel = holding.bank ?? "—";
          const updatedLabel = formatDate(holding.updated_at);

          const rowClass = `px-4 py-3 ${
            stale ? "border-l-2 border-l-red-500 bg-red-950/10" : ""
          }`;

          return (
            <li key={holding.holding_id}>
              <div className={`md:hidden ${rowClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <HoldingNameCell holding={holding} className="min-w-0 flex-1" />
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {formatMoney(value, currency)}
                    </span>
                    <RiskBadge risk={risk} />
                    <PnlCell pnlPct={pnlPct} />
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  <span>{typeLabel}</span>
                  <span>{bankLabel}</span>
                  <span className="tabular-nums">{updatedLabel}</span>
                </div>
              </div>

              <div className={`hidden md:grid ${rowGrid} ${rowClass}`}>
                <HoldingNameCell holding={holding} className="min-w-0" />
                <span className="text-right font-medium tabular-nums">
                  {formatMoney(value, currency)}
                </span>
                <RiskBadge risk={risk} />
                <PnlCell pnlPct={pnlPct} className="text-right" />
                <span className={`truncate ${secondaryMeta}`}>{typeLabel}</span>
                <span className={`truncate ${secondaryMeta}`}>{bankLabel}</span>
                <span className={`text-right tabular-nums ${secondaryMeta}`}>
                  {updatedLabel}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HoldingNameCell({
  holding,
  className = "",
}: {
  holding: Holding;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="font-medium leading-snug">{holding.name}</div>
      {holding.ticker && (
        <div className="text-xs text-[var(--muted)]">{holding.ticker}</div>
      )}
    </div>
  );
}

function RiskBadge({ risk }: { risk?: number }) {
  if (risk == null) {
    return (
      <span className="inline-flex w-8 shrink-0 justify-center justify-self-start text-[var(--muted)]">
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex w-8 shrink-0 justify-center justify-self-start items-center rounded px-1 py-0.5 text-xs font-medium text-white"
      style={{ background: RISK_COLORS[risk] ?? "#71767b" }}
    >
      R{risk}
    </span>
  );
}

function PnlCell({ pnlPct, className = "" }: { pnlPct: number; className?: string }) {
  return (
    <span
      className={`shrink-0 tabular-nums ${className} ${
        pnlPct >= 0 ? "text-green-400" : "text-red-400"
      }`}
    >
      {formatPct(pnlPct)}
    </span>
  );
}
