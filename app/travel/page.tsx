"use client";

import { useCallback } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { TravelMap } from "@/components/travel-map";
import { TravelStatsPanel } from "@/components/travel-stats-panel";
import { VisitTimeline } from "@/components/visit-timeline";
import type { Flight, Train, TravelStats, VisitWithImages } from "@/lib/types/travel";
import { useOtsCache } from "@/lib/use-ots-cache";

interface TravelCache {
  visits: VisitWithImages[];
  flights: Flight[];
  trains: Train[];
  stats: TravelStats | null;
}

export default function TravelPage() {
  const fetchTravel = useCallback(async (): Promise<TravelCache> => {
    const res = await fetch("/api/travel/visits/");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const body = await res.json();
    return {
      visits: Array.isArray(body.visits) ? body.visits : [],
      flights: Array.isArray(body.flights) ? body.flights : [],
      trains: Array.isArray(body.trains) ? body.trains : [],
      stats: body.stats ?? null,
    };
  }, []);

  const { data, loading, error } = useOtsCache("travel", fetchTravel);

  const visits = data?.visits ?? [];
  const flights = data?.flights ?? [];
  const trains = data?.trains ?? [];
  const stats = data?.stats ?? null;

  return (
    <AuthGuard>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Travel Log</h1>
          <p className="mt-1 text-[var(--muted)]">
            Visits, photos, flights, and rail journeys
          </p>
        </div>

        {loading && <p className="text-[var(--muted)]">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {stats && (
          <>
            <TravelStatsPanel stats={stats} />
            <TravelMap
              byProvince={stats.visits.byProvince}
              flights={flights}
              trains={trains}
            />
          </>
        )}

        {!loading && !error && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Timeline</h2>
            <VisitTimeline visits={visits} />
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
