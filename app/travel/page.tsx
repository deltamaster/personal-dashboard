"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { TravelMap } from "@/components/travel-map";
import { TravelStatsPanel } from "@/components/travel-stats-panel";
import { VisitTimeline } from "@/components/visit-timeline";
import type { Flight, Train, TravelStats, VisitWithImages } from "@/lib/types/travel";

export default function TravelPage() {
  const [visits, setVisits] = useState<VisitWithImages[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/travel/visits/");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setVisits(Array.isArray(data.visits) ? data.visits : []);
      setFlights(Array.isArray(data.flights) ? data.flights : []);
      setTrains(Array.isArray(data.trains) ? data.trains : []);
      setStats(data.stats ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load travel data");
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
