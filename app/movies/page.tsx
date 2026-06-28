"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { MovieCard } from "@/components/movie-card";
import { AddMovieForm, MovieStatsPanel } from "@/components/movies-panel";
import { MoviesToolbar } from "@/components/movies-toolbar";
import {
  distinctReleaseYears,
  emptyMovieFilters,
  filterMovies,
} from "@/lib/movies-filter";
import type { Movie, MovieStats } from "@/lib/types/movie";

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [stats, setStats] = useState<MovieStats | null>(null);
  const [filters, setFilters] = useState(emptyMovieFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/movies/");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMovies(Array.isArray(data.movies) ? data.movies : []);
      setStats(data.stats ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load movies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const releaseYears = useMemo(() => distinctReleaseYears(movies), [movies]);
  const filteredMovies = useMemo(
    () => filterMovies(movies, filters),
    [movies, filters]
  );

  return (
    <AuthGuard>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Cinema Room</h1>
            <p className="mt-1 text-[var(--muted)]">Your watched movies log</p>
          </div>
          <AddMovieForm onAdded={load} />
        </div>

        {loading && <p className="text-[var(--muted)]">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && movies.length > 0 && (
          <MoviesToolbar
            filters={filters}
            releaseYears={releaseYears}
            onChange={setFilters}
            resultCount={filteredMovies.length}
            totalCount={movies.length}
          />
        )}

        {stats && <MovieStatsPanel stats={stats} />}

        {!loading && movies.length === 0 && !error && (
          <p className="text-[var(--muted)]">No movies yet. Add your first one above.</p>
        )}

        {!loading && movies.length > 0 && filteredMovies.length === 0 && (
          <p className="text-[var(--muted)]">No movies match your search or filters.</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredMovies.map((movie) => (
            <MovieCard key={movie.douban_subject_id} movie={movie} />
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
