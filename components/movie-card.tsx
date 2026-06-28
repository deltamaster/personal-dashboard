import type { Movie } from "@/lib/types/movie";

function starCount(rating: number): number {
  const n = Number(rating);
  if (Number.isNaN(n)) return 0;
  return Math.min(5, Math.max(0, Math.round(n)));
}

function Stars({ rating }: { rating: number }) {
  const n = starCount(rating);
  return (
    <span className="text-amber-400" aria-label={`${n} stars`}>
      {"★".repeat(n)}
      <span className="text-[var(--border)]">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function MovieCard({ movie }: { movie: Movie }) {
  const href = movie.movie_url ?? `https://movie.douban.com/subject/${movie.douban_subject_id}/`;

  return (
    <article className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-shadow hover:shadow-lg hover:shadow-black/30">
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        <div className="relative aspect-[2/3] bg-[var(--border)]">
          {movie.poster_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.poster_url}
              alt={movie.title_primary}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[var(--muted)]">
              {movie.title_primary}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
            <Stars rating={movie.user_rating} />
            <p className="mt-1 text-xs text-gray-300">{movie.watched_date}</p>
          </div>
        </div>
        <div className="p-3">
          <h3 className="truncate font-medium">{movie.title_primary}</h3>
          {movie.title_alt && (
            <p className="truncate text-xs text-[var(--muted)]">{movie.title_alt}</p>
          )}
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>{movie.release_year ?? "—"}</span>
            <Stars rating={movie.user_rating} />
          </div>
          {movie.director && (
            <p className="mt-1 truncate text-xs text-[var(--muted)]">{movie.director}</p>
          )}
        </div>
      </a>
    </article>
  );
}
