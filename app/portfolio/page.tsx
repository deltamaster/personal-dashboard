"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { HoldingsTable, PortfolioStatsPanel } from "@/components/portfolio-panel";
import { sortHoldingsByCnyValue } from "@/lib/portfolio-format";
import type { Holding, PortfolioStats, Snapshot } from "@/lib/types/portfolio";

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [holdingsRes, snapshotsRes] = await Promise.all([
        fetch("/api/portfolio/holdings/"),
        fetch("/api/portfolio/snapshots/"),
      ]);

      if (!holdingsRes.ok) {
        const data = await holdingsRes.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${holdingsRes.status}`);
      }

      const holdingsData = await holdingsRes.json();
      const rows = Array.isArray(holdingsData.holdings) ? holdingsData.holdings : [];
      setHoldings(sortHoldingsByCnyValue(rows));
      setStats(holdingsData.stats ?? null);

      if (snapshotsRes.ok) {
        const snapshotsData = await snapshotsRes.json();
        setSnapshots(
          Array.isArray(snapshotsData.snapshots) ? snapshotsData.snapshots : []
        );
      } else {
        setSnapshots([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AuthGuard>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="mt-1 text-[var(--muted)]">
            Holdings, risk allocation, and NAV snapshots
          </p>
        </div>

        {loading && <p className="text-[var(--muted)]">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {stats && (
          <PortfolioStatsPanel stats={stats} snapshots={snapshots} />
        )}

        {!loading && !error && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Holdings</h2>
            <HoldingsTable
              holdings={holdings}
              staleHoldingIds={stats?.staleHoldingIds ?? []}
            />
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
