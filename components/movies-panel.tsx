"use client";

import { useState } from "react";
import type { MovieStats } from "@/lib/types/movie";

export function MovieStatsPanel({ stats }: { stats: MovieStats }) {
  const byYear = stats.byYear ?? [];
  const directors = stats.directors ?? [];
  const fiveStar = stats.fiveStar ?? [];
  const maxYearCount = Math.max(...byYear.map((y) => y.count), 1);
  const topDirectors = directors.slice(0, 8);
  const maxDirectorCount = Math.max(...topDirectors.map((d) => d.count), 1);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">Total watched</p>
        <p className="mt-1 text-3xl font-bold">{stats.total}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {fiveStar.length} five-star picks
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:col-span-2">
        <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">By release year</h3>
        {byYear.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No data yet</p>
        ) : (
          <div className="flex items-end gap-1 h-24">
            {byYear.map(({ year, count }) => (
              <div key={year} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-[var(--accent)]/80"
                  style={{ height: `${(count / maxYearCount) * 100}%`, minHeight: count ? 4 : 0 }}
                  title={`${year}: ${count}`}
                />
                <span className="text-[10px] text-[var(--muted)]">{String(year).slice(-2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:col-span-3">
        <h3 className="mb-3 text-sm font-medium text-[var(--muted)]">Top directors</h3>
        {topDirectors.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No data yet</p>
        ) : (
          <ul className="space-y-2">
            {topDirectors.map(({ director, count, avgRating }) => (
              <li key={director} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate">{director}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${(count / maxDirectorCount) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[var(--muted)]">
                  {count} · ★{avgRating}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AddMovieForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      douban_subject_id: String(form.get("douban_subject_id")),
      title_primary: String(form.get("title_primary")),
      title_alt: String(form.get("title_alt") || "") || undefined,
      user_rating: Number(form.get("user_rating")),
      watched_date: String(form.get("watched_date")),
      release_year: Number(form.get("release_year")) || undefined,
      director: String(form.get("director") || "") || undefined,
      poster_url: String(form.get("poster_url") || "") || undefined,
      genres: String(form.get("genres") || "") || undefined,
    };

    const res = await fetch("/api/movies/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add movie");
      return;
    }

    setOpen(false);
    onAdded();
    (e.target as HTMLFormElement).reset();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Add movie
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3"
    >
      <h3 className="font-medium">Add movie</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Douban ID *
          <input name="douban_subject_id" required className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" placeholder="1292052" />
        </label>
        <label className="block text-sm">
          Title (中文) *
          <input name="title_primary" required className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          Alt title
          <input name="title_alt" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          Watched date *
          <input name="watched_date" type="date" required className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          Rating *
          <select name="user_rating" required defaultValue="4" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n} stars</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Release year
          <input name="release_year" type="number" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm sm:col-span-2">
          Director(s) — separate with &quot; / &quot;
          <input name="director" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm sm:col-span-2">
          Poster URL
          <input name="poster_url" type="url" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm sm:col-span-2">
          Genres — separate with &quot; / &quot;
          <input name="genres" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-50">
          {loading ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
