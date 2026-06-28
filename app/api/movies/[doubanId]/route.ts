import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { updateMovie } from "@/lib/ots/movies";

type RouteContext = { params: { doubanId: string } };

export async function PUT(request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const { doubanId } = context.params;

  try {
    const body = await request.json();

    if (body.user_rating !== undefined && (body.user_rating < 1 || body.user_rating > 5)) {
      return NextResponse.json({ error: "user_rating must be 1–5" }, { status: 400 });
    }

    const movie = await updateMovie(doubanId, body);
    if (!movie) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    return NextResponse.json(movie);
  } catch (e) {
    console.error(`PUT /api/movies/${doubanId}`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update movie" },
      { status: 500 }
    );
  }
}
