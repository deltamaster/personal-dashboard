import { getOtsClient, nextStartPrimaryKey, rowToObject, toAttributeColumns } from "@/lib/ots";
import { otsCall, TableStore } from "@/lib/ots-client";
import {
  createSongRecord,
  rowToSong,
  updateSongRecord,
  type SongRecord,
} from "../../functions/www-songs/song-record.js";
import type { Song, SongInput } from "@/lib/types/song";

const TABLE = process.env.SONGS_TABLE?.trim() || "www_songs";

function asSong(record: SongRecord): Song {
  return {
    id: record.id,
    name: record.name,
    singers: record.singers,
    status: record.status === "HIDDEN" ? "HIDDEN" : "OK",
  };
}

function fromRow(row: Parameters<typeof rowToObject>[0]): Song | null {
  const record = rowToSong(rowToObject(row));
  return record ? asSong(record) : null;
}

export async function listSongs(): Promise<Song[]> {
  const client = await getOtsClient();
  const songs: Song[] = [];
  let startKey: Record<string, unknown>[] = [{ song_id: TableStore.INF_MIN }];
  let done = false;

  while (!done) {
    const result = await otsCall<{
      rows?: unknown[];
      nextStartPrimaryKey?: { name: string; value: unknown }[];
    }>(client.getRange.bind(client), {
      tableName: TABLE,
      direction: TableStore.Direction.FORWARD,
      inclusiveStartPrimaryKey: startKey,
      exclusiveEndPrimaryKey: [{ song_id: TableStore.INF_MAX }],
      limit: 100,
    });

    for (const row of result.rows ?? []) {
      const song = fromRow(row as Parameters<typeof rowToObject>[0]);
      if (song) songs.push(song);
    }

    const next = result.nextStartPrimaryKey;
    if (next?.length) {
      startKey = nextStartPrimaryKey(next);
    } else {
      done = true;
    }
  }

  return songs;
}

async function putSong(song: Song): Promise<void> {
  const client = await getOtsClient();
  await otsCall(client.putRow.bind(client), {
    tableName: TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ song_id: song.id }],
    attributeColumns: toAttributeColumns({
      name: song.name,
      singers: JSON.stringify(song.singers),
      status: song.status,
    }),
  });
}

export async function createSong(input: SongInput): Promise<Song> {
  const existing = await listSongs();
  const created = asSong(createSongRecord(existing, input));
  await putSong(created);
  return created;
}

export async function updateSong(id: string, patch: SongInput): Promise<Song | null> {
  const existing = await listSongs();
  const updated = updateSongRecord(existing, id, patch);
  if (!updated) return null;
  const song = asSong(updated);
  await putSong(song);
  return song;
}

export async function deleteSong(id: string): Promise<boolean> {
  const existing = await listSongs();
  if (!existing.some((song) => song.id === id)) return false;

  const client = (await getOtsClient()) as unknown as {
    deleteRow: (
      params: Record<string, unknown>,
      callback: (err: Error | null, data?: unknown) => void
    ) => void;
  };
  await otsCall(client.deleteRow.bind(client), {
    tableName: TABLE,
    condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
    primaryKey: [{ song_id: id }],
  });
  return true;
}
