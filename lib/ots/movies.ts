import { getOtsClient, rowToObject, toAttributeColumns } from "@/lib/ots";
import { otsCall, TableStore } from "@/lib/ots-client";
import type { DirectorStat, Movie, MovieInput, MovieStats } from "@/lib/types/movie";

const TABLE = "pd_movies";

function nowIso(): string {
  return new Date().toISOString();
}

function parseDirectors(director?: string): string[] {
  if (!director) return [];
  return director.split(" / ").map((d) => d.trim()).filter(Boolean);
}

export async function listMovies(): Promise<Movie[]> {
  const client = getOtsClient();
  const movies: Movie[] = [];
  let startKey: { douban_subject_id: unknown }[] = [{ douban_subject_id: TableStore.INF_MIN }];
  let done = false;

  while (!done) {
    const result = await otsCall<{ rows?: unknown[]; nextStartPrimaryKey?: unknown[] }>(
      client.getRange.bind(client),
      {
        tableName: TABLE,
        direction: TableStore.Direction.FORWARD,
        inclusiveStartPrimaryKey: startKey,
        inclusiveEndPrimaryKey: [{ douban_subject_id: TableStore.INF_MAX }],
        limit: 100,
      }
    );

    for (const row of result.rows ?? []) {
      movies.push(rowToObject(row as Parameters<typeof rowToObject>[0]) as unknown as Movie);
    }

    if (result.nextStartPrimaryKey) {
      startKey = result.nextStartPrimaryKey as { douban_subject_id: unknown }[];
    } else {
      done = true;
    }
  }

  return movies.sort((a, b) => b.watched_date.localeCompare(a.watched_date));
}

export async function getMovie(doubanSubjectId: string): Promise<Movie | null> {
  const client = getOtsClient();
  try {
    const result = await otsCall<{ row?: unknown }>(client.getRow.bind(client), {
      tableName: TABLE,
      primaryKey: [{ douban_subject_id: doubanSubjectId }],
    });
    if (!result.row) return null;
    return rowToObject(result.row as Parameters<typeof rowToObject>[0]) as unknown as Movie;
  } catch {
    return null;
  }
}

export async function createMovie(input: MovieInput): Promise<Movie> {
  const client = getOtsClient();
  const ts = nowIso();
  const movie: Movie = {
    ...input,
    created_at: input.created_at ?? ts,
    updated_at: input.updated_at ?? ts,
  };

  await otsCall(client.putRow.bind(client), {
    tableName: TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ douban_subject_id: movie.douban_subject_id }],
    attributeColumns: toAttributeColumns({
      title_primary: movie.title_primary,
      title_alt: movie.title_alt,
      intro: movie.intro,
      user_rating: movie.user_rating,
      watched_date: movie.watched_date,
      movie_url: movie.movie_url,
      poster_url: movie.poster_url,
      comment_id: movie.comment_id,
      release_year: movie.release_year,
      director: movie.director,
      country: movie.country,
      language: movie.language,
      duration_minutes: movie.duration_minutes,
      genres: movie.genres,
      created_at: movie.created_at,
      updated_at: movie.updated_at,
    }),
  });

  return movie;
}

export async function updateMovie(
  doubanSubjectId: string,
  patch: Partial<Omit<MovieInput, "douban_subject_id">>
): Promise<Movie | null> {
  const existing = await getMovie(doubanSubjectId);
  if (!existing) return null;

  const updated: Movie = {
    ...existing,
    ...patch,
    douban_subject_id: doubanSubjectId,
    updated_at: nowIso(),
  };

  const client = getOtsClient();
  await otsCall(client.putRow.bind(client), {
    tableName: TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ douban_subject_id: doubanSubjectId }],
    attributeColumns: toAttributeColumns({
      title_primary: updated.title_primary,
      title_alt: updated.title_alt,
      intro: updated.intro,
      user_rating: updated.user_rating,
      watched_date: updated.watched_date,
      movie_url: updated.movie_url,
      poster_url: updated.poster_url,
      comment_id: updated.comment_id,
      release_year: updated.release_year,
      director: updated.director,
      country: updated.country,
      language: updated.language,
      duration_minutes: updated.duration_minutes,
      genres: updated.genres,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    }),
  });

  return updated;
}

export function computeMovieStats(movies: Movie[]): MovieStats {
  const yearMap = new Map<number, number>();
  const directorMap = new Map<string, { count: number; totalRating: number }>();

  for (const movie of movies) {
    if (movie.release_year) {
      yearMap.set(movie.release_year, (yearMap.get(movie.release_year) ?? 0) + 1);
    }
    for (const name of parseDirectors(movie.director)) {
      const entry = directorMap.get(name) ?? { count: 0, totalRating: 0 };
      entry.count += 1;
      entry.totalRating += movie.user_rating;
      directorMap.set(name, entry);
    }
  }

  const byYear = Array.from(yearMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  const directors: DirectorStat[] = Array.from(directorMap.entries())
    .map(([director, { count, totalRating }]) => ({
      director,
      count,
      avgRating: Math.round((totalRating / count) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count || b.avgRating - a.avgRating);

  const fiveStar = movies
    .filter((m) => m.user_rating === 5)
    .sort((a, b) => b.watched_date.localeCompare(a.watched_date));

  return { total: movies.length, byYear, directors, fiveStar };
}
