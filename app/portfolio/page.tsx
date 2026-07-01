"use client";

import { useCallback } from "react";
import { AuthGuard } from "@/components/auth-guard";
import {
  PortfolioAmountsToggle,
  PortfolioPrivacyProvider,
} from "@/components/portfolio-privacy";
import { HoldingsTable, PortfolioStatsPanel } from "@/components/portfolio-panel";
import { sortHoldingsByCnyValue } from "@/lib/portfolio-format";
import type { Holding, PortfolioStats, Snapshot } from "@/lib/types/portfolio";
import { OTS_FETCH_INIT, useOtsCache } from "@/lib/use-ots-cache";

interface PortfolioCache {
  holdings: Holding[];
  stats: PortfolioStats | null;
  snapshots: Snapshot[];
}

export default function PortfolioPage() {
  const fetchPortfolio = useCallback(async (): Promise<PortfolioCache> => {
    const [holdingsRes, snapshotsRes] = await Promise.all([
      fetch("/api/portfolio/holdings/", OTS_FETCH_INIT),
      fetch("/api/portfolio/snapshots/", OTS_FETCH_INIT),
    ]);

    if (!holdingsRes.ok) {
      const body = await holdingsRes.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${holdingsRes.status}`);
    }

    const holdingsData = await holdingsRes.json();
    const rows = Array.isArray(holdingsData.holdings) ? holdingsData.holdings : [];

    let snapshots: Snapshot[] = [];
    if (snapshotsRes.ok) {
      const snapshotsData = await snapshotsRes.json();
      snapshots = Array.isArray(snapshotsData.snapshots)
        ? snapshotsData.snapshots
        : [];
    }

    return {
      holdings: sortHoldingsByCnyValue(rows),
      stats: holdingsData.stats ?? null,
      snapshots,
    };
  }, []);

  const { data, loading, error, refresh } = useOtsCache("portfolio", fetchPortfolio);

  const holdings = data?.holdings ?? [];
  const stats = data?.stats ?? null;
  const snapshots = data?.snapshots ?? [];

  return (
    <AuthGuard>
      <PortfolioPrivacyProvider>
        <div className="space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Portfolio</h1>
              <p className="mt-1 text-[var(--muted)]">
                Holdings, risk allocation, and NAV snapshots
              </p>
            </div>
            <PortfolioAmountsToggle />
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
              onRedeemed={refresh}
            />
          </div>
        )}
        </div>
      </PortfolioPrivacyProvider>
    </AuthGuard>
  );
}
