import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { deleteSong, updateSong } from "@/lib/ots/songs";
import { deleteDummySong, shouldUseSongsDummyData, updateDummySong } from "@/lib/songs-dummy-data";
import type { SongInput } from "@/lib/types/song";

type RouteContext = { params: { id: string } };

function songError(e: unknown, fallback: string) {
  const message = e instanceof Error ? e.message : fallback;
  const status = /already exists/.test(message)
    ? 409
    : /needs a name|At least one field|status must|tag |too many tags/.test(message)
      ? 400
      : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function PUT(request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const id = decodeURIComponent(context.params.id);
  let body: SongInput;
  try {
    body = (await request.json()) as SongInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const song = shouldUseSongsDummyData()
      ? updateDummySong(id, body)
      : isOtsConfigured()
        ? await updateSong(id, body)
        : null;
    if (!shouldUseSongsDummyData() && !isOtsConfigured()) {
      return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
    }
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }
    return NextResponse.json(song);
  } catch (e) {
    console.error(`PUT /api/songs/${id}`, e);
    return songError(e, "Failed to update song");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { error } = await requireSession();
  if (error) return error;

  const id = decodeURIComponent(context.params.id);

  try {
    if (!shouldUseSongsDummyData() && !isOtsConfigured()) {
      return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
    }
    const deleted = shouldUseSongsDummyData() ? deleteDummySong(id) : await deleteSong(id);
    if (!deleted) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`DELETE /api/songs/${id}`, e);
    return songError(e, "Failed to delete song");
  }
}
