import type { Movie } from "@/lib/types/movie";

export type MovieFilters = {
  query: string;
  releaseYear: number | null;
  minRating: number | null;
};

export const emptyMovieFilters: MovieFilters = {
  query: "",
  releaseYear: null,
  minRating: null,
};

function searchHaystack(movie: Movie): string {
  return [
    movie.title_primary,
    movie.title_alt,
    movie.director,
    movie.actors,
    movie.intro,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Substring match; all whitespace-separated tokens must match somewhere. */
export function matchesMovieQuery(movie: Movie, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = searchHaystack(movie);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

export function filterMovies(movies: Movie[], filters: MovieFilters): Movie[] {
  return movies.filter((movie) => {
    if (!matchesMovieQuery(movie, filters.query)) return false;
    if (filters.releaseYear != null && movie.release_year !== filters.releaseYear) {
      return false;
    }
    if (filters.minRating != null && movie.user_rating < filters.minRating) {
      return false;
    }
    return true;
  });
}

export function distinctReleaseYears(movies: Movie[]): number[] {
  const years = new Set<number>();
  for (const movie of movies) {
    if (movie.release_year != null) years.add(movie.release_year);
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function hasActiveFilters(filters: MovieFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.releaseYear != null ||
    filters.minRating != null
  );
}
