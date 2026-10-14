import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isOtsConfigured } from "@/lib/ots-config";
import { createSong, listSongs } from "@/lib/ots/songs";
import { createDummySong, listDummySongs, shouldUseSongsDummyData } from "@/lib/songs-dummy-data";
import type { SongInput } from "@/lib/types/song";

function songError(e: unknown, fallback: string) {
  const message = e instanceof Error ? e.message : fallback;
  const status = /already exists/.test(message)
    ? 409
    : /needs a name|At least one field|status must|tag |too many tags/.test(message)
      ? 400
      : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  if (shouldUseSongsDummyData()) {
    return NextResponse.json({ songs: listDummySongs() });
  }

  if (!isOtsConfigured()) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ songs: [] });
    }
    return NextResponse.json({ error: "OTS is not configured" }, { status: 503 });
  }

  try {
    const songs = await listSongs();
    return NextResponse.json({ songs });
  } catch (e) {
    console.error("GET /api/songs", e);
    return songError(e, "Failed to list songs");
  }
}

export async function POST(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  let body: SongInput;
  try {
    body = (await request.json()) as SongInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (shouldUseSongsDummyData()) {
      return NextResponse.json(createDummySong(body), { status: 201 });
    }
    if (!isOtsConfigured()) {
      return NextResponse.json(
        { error: "OTS is not configured — add Alibaba credentials to .env.local" },
        { status: 503 }
      );
    }
    const song = await createSong(body);
    return NextResponse.json(song, { status: 201 });
  } catch (e) {
    console.error("POST /api/songs", e);
    return songError(e, "Failed to create song");
  }
}
