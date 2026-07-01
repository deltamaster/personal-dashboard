"use client";

import { useCallback, useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { TravelMap } from "@/components/travel-map";
import { TravelStatsPanel } from "@/components/travel-stats-panel";
import { VisitTimeline } from "@/components/visit-timeline";
import { filterVisitsBySearch } from "@/lib/travel-search";
import type { Flight, Train, TravelStats, VisitWithImages } from "@/lib/types/travel";
import { OTS_FETCH_INIT, useOtsCache } from "@/lib/use-ots-cache";

interface TravelCache {
  visits: VisitWithImages[];
  flights: Flight[];
  trains: Train[];
  stats: TravelStats | null;
}

export default function TravelPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTravel = useCallback(async (): Promise<TravelCache> => {
    const res = await fetch("/api/travel/visits/", OTS_FETCH_INIT);
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

  const { data, loading, error, patchData } = useOtsCache("travel", fetchTravel);

  const handleVisitUpdated = useCallback((updated: VisitWithImages) => {
    patchData((current) => ({
      ...current,
      visits: current.visits
        .map((visit) =>
          visit.visit_id === updated.visit_id
            ? { ...visit, ...updated, images: updated.images ?? visit.images }
            : visit
        )
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    }));
  }, [patchData]);

  const visits = data?.visits ?? [];
  const flights = data?.flights ?? [];
  const trains = data?.trains ?? [];
  const stats = data?.stats ?? null;

  const isSearching = searchQuery.trim().length > 0;
  const filteredVisits = useMemo(
    () => filterVisitsBySearch(data?.visits ?? [], searchQuery),
    [data?.visits, searchQuery]
  );

  return (
    <AuthGuard>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Travel Log</h1>
          <p className="mt-1 text-[var(--muted)]">
            Visits, photos, flights, and rail journeys
          </p>
        </div>

        {!loading && !error && (
          <div className="space-y-2">
            <label className="block w-full max-w-md">
              <span className="sr-only">Search visits</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country, province, city, attraction…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            {isSearching && (
              <p className="text-sm text-[var(--muted)]">
                {filteredVisits.length} visit{filteredVisits.length === 1 ? "" : "s"} matching
                &ldquo;{searchQuery.trim()}&rdquo;
              </p>
            )}
          </div>
        )}

        {loading && <p className="text-[var(--muted)]">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {stats && !isSearching && (
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
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Timeline</h2>
            {isSearching && filteredVisits.length === 0 ? (
              <p className="text-[var(--muted)]">No visits match your search.</p>
            ) : (
              <VisitTimeline visits={filteredVisits} onVisitUpdated={handleVisitUpdated} />
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
