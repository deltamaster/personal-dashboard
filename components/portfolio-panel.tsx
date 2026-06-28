"use client";

import type { Holding, PortfolioStats, Snapshot } from "@/lib/types/portfolio";

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

function formatMoney(value: number, currency = "CNY"): string {
  const prefix = currency === "CNY" ? "¥" : currency === "USD" ? "$" : currency === "HKD" ? "HK$" : "";
  const abs = Math.abs(value);
  if (abs >= 10000) {
    return `${prefix}${(value / 10000).toFixed(2)}万`;
  }
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

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

export function PortfolioStatsPanel({
  stats,
  snapshots,
}: {
  stats: PortfolioStats;
  snapshots: Snapshot[];
}) {
  const maxRiskValue = Math.max(...stats.byRiskLevel.map((r) => r.value), 1);
  const chartBarMaxPx = 96;
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

  const snapshotValues = snapshots
    .filter((s) => s.total_value != null)
    .slice(-24);
  const maxSnapshotValue = Math.max(...snapshotValues.map((s) => s.total_value ?? 0), 1);

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
          <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">
            Risk level (R1–R5) by value
          </h3>
          <div className="flex h-28 items-end gap-2">
            {stats.byRiskLevel.map(({ level, value, count }) => (
              <div
                key={level}
                className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.max(
                      value > 0 ? 4 : 0,
                      Math.round((value / maxRiskValue) * chartBarMaxPx)
                    )}px`,
                    background: RISK_COLORS[level],
                  }}
                  title={`R${level}: ${formatMoney(value)} (${count})`}
                />
                <span className="text-[10px] text-[var(--muted)]">R{level}</span>
                {count > 0 && (
                  <span className="text-[10px] text-[var(--muted)]">{count}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {snapshotValues.length > 1 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">NAV history</h3>
            <div className="flex h-28 items-end gap-0.5 overflow-x-auto pb-1">
              {snapshotValues.map((snapshot) => (
                <div
                  key={snapshot.snapshot_date}
                  className="flex min-w-[0.5rem] flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="w-full rounded-t bg-[var(--accent)]"
                    style={{
                      height: `${Math.max(
                        4,
                        Math.round(
                          ((snapshot.total_value ?? 0) / maxSnapshotValue) * chartBarMaxPx
                        )
                      )}px`,
                    }}
                    title={`${snapshot.snapshot_date}: ${formatMoney(snapshot.total_value ?? 0)}`}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {snapshotValues[0]?.snapshot_date} →{" "}
              {snapshotValues[snapshotValues.length - 1]?.snapshot_date}
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

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--card)] text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Bank</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Risk</th>
            <th className="px-4 py-3 font-medium text-right">Value</th>
            <th className="px-4 py-3 font-medium text-right">P&amp;L</th>
            <th className="px-4 py-3 font-medium text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => {
            const stale = staleSet.has(holding.holding_id);
            const currency = holding.currency ?? "CNY";
            const value = holding.current_value ?? 0;
            const pnlPct = holding.unrealized_pct ?? 0;
            const risk = holding.risk_level;

            return (
              <tr
                key={holding.holding_id}
                className={`border-b border-[var(--border)] last:border-0 ${
                  stale ? "border-l-2 border-l-red-500 bg-red-950/10" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{holding.name}</div>
                  {holding.ticker && (
                    <div className="text-xs text-[var(--muted)]">{holding.ticker}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {holding.bank ?? "—"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {ASSET_TYPE_LABELS[holding.asset_type ?? ""] ??
                    holding.asset_type ??
                    "—"}
                </td>
                <td className="px-4 py-3">
                  {risk != null ? (
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-white"
                      style={{ background: RISK_COLORS[risk] ?? "#71767b" }}
                    >
                      R{risk}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney(value, currency)}
                </td>
                <td
                  className={`px-4 py-3 text-right ${
                    pnlPct >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatPct(pnlPct)}
                </td>
                <td className="px-4 py-3 text-right text-[var(--muted)]">
                  {formatDate(holding.updated_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
