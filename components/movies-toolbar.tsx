"use client";

import type { MovieFilters } from "@/lib/movies-filter";

type Props = {
  filters: MovieFilters;
  releaseYears: number[];
  onChange: (filters: MovieFilters) => void;
  resultCount: number;
  totalCount: number;
};

const inputClass =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

export function MoviesToolbar({
  filters,
  releaseYears,
  onChange,
  resultCount,
  totalCount,
}: Props) {
  const filtered = resultCount !== totalCount;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 text-sm">
          Search
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Title, alias, director, actors…"
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <label className="text-sm">
          Release year
          <select
            value={filters.releaseYear ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                releaseYear: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={`${inputClass} mt-1 min-w-[7rem]`}
          >
            <option value="">All years</option>
            {releaseYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Min rating
          <select
            value={filters.minRating ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                minRating: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={`${inputClass} mt-1 min-w-[7rem]`}
          >
            <option value="">Any</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n}★ & up
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm text-[var(--muted)]">
        {filtered
          ? `Showing ${resultCount} of ${totalCount} movies`
          : `${totalCount} movies`}
      </p>
    </div>
  );
}
