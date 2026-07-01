"use client";

import { useCallback, useMemo, useState } from "react";
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
import { useOtsCache } from "@/lib/use-ots-cache";

interface MoviesCache {
  movies: Movie[];
  stats: MovieStats | null;
}

export default function MoviesPage() {
  const [filters, setFilters] = useState(emptyMovieFilters);

  const fetchMovies = useCallback(async (): Promise<MoviesCache> => {
    const res = await fetch("/api/movies/");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const body = await res.json();
    return {
      movies: Array.isArray(body.movies) ? body.movies : [],
      stats: body.stats ?? null,
    };
  }, []);

  const { data, loading, error, refresh } = useOtsCache("movies", fetchMovies);

  const movies = data?.movies ?? [];
  const stats = data?.stats ?? null;

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
          <AddMovieForm onAdded={refresh} />
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

        <div className="grid min-w-0 gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(9rem,100%),1fr))]">
          {filteredMovies.map((movie) => (
            <MovieCard key={movie.douban_subject_id} movie={movie} />
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
