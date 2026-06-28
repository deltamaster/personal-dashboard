import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { createMovie, listMovies, computeMovieStats } from "@/lib/ots/movies";
import { emptyMovieStats, isOtsConfigured } from "@/lib/ots-config";
import type { MovieInput } from "@/lib/types/movie";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  if (!isOtsConfigured()) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ movies: [], stats: emptyMovieStats });
    }
    return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
  }

  try {
    const movies = await listMovies();
    const stats = computeMovieStats(movies);
    return NextResponse.json({ movies, stats });
  } catch (e) {
    console.error("GET /api/movies", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list movies" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  if (!isOtsConfigured()) {
    return NextResponse.json(
      { error: "OTS is not configured — add Alibaba credentials to .env.local" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as Partial<MovieInput>;

    if (!body.douban_subject_id?.trim()) {
      return NextResponse.json({ error: "douban_subject_id is required" }, { status: 400 });
    }
    if (!body.title_primary?.trim()) {
      return NextResponse.json({ error: "title_primary is required" }, { status: 400 });
    }
    if (!body.watched_date) {
      return NextResponse.json({ error: "watched_date is required" }, { status: 400 });
    }
    const rating = body.user_rating ?? 0;
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "user_rating must be 1–5" }, { status: 400 });
    }

    const movie = await createMovie({
      douban_subject_id: body.douban_subject_id.trim(),
      title_primary: body.title_primary.trim(),
      title_alt: body.title_alt?.trim(),
      intro: body.intro,
      user_rating: rating,
      watched_date: body.watched_date,
      movie_url: body.movie_url ?? `https://movie.douban.com/subject/${body.douban_subject_id.trim()}/`,
      poster_url: body.poster_url,
      comment_id: body.comment_id,
      release_year: body.release_year,
      director: body.director,
      country: body.country,
      language: body.language,
      duration_minutes: body.duration_minutes,
      genres: body.genres,
    });

    return NextResponse.json(movie, { status: 201 });
  } catch (e) {
    console.error("POST /api/movies", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create movie" },
      { status: 500 }
    );
  }
}
