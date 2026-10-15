import { createSongRecord, updateSongRecord } from "../functions/www-songs/song-record.js";
import type { Song, SongInput } from "@/lib/types/song";

/** Dev/QA sample data — QA_DUMMY_DATA (any env) or SONGS_DUMMY_DATA=1 (dev only). */
export function shouldUseSongsDummyData(): boolean {
  if (process.env.QA_DUMMY_DATA === "1") return true;
  if (process.env.NODE_ENV !== "development") return false;
  return process.env.SONGS_DUMMY_DATA === "1";
}

const dummySongs: Song[] = [
  { id: "rQuiet", name: "安静", singers: ["周杰伦"], tags: [] },
  { id: "rSunny", name: "晴天", singers: ["周杰伦"], tags: ["learning"] },
  { id: "rHide1", name: "内部彩排", singers: ["测试"], tags: ["hidden"] },
];

function clone(song: Song): Song {
  return { id: song.id, name: song.name, singers: [...song.singers], tags: [...song.tags] };
}

export function listDummySongs(): Song[] {
  return dummySongs.map(clone);
}

export function createDummySong(input: SongInput): Song {
  const created = createSongRecord(dummySongs, input);
  const song: Song = {
    id: created.id,
    name: created.name,
    singers: created.singers,
    tags: [...created.tags],
  };
  dummySongs.push(song);
  return clone(song);
}

export function updateDummySong(id: string, patch: SongInput): Song | null {
  const updated = updateSongRecord(dummySongs, id, patch);
  if (!updated) return null;
  const index = dummySongs.findIndex((song) => song.id === id);
  const song: Song = {
    id: updated.id,
    name: updated.name,
    singers: updated.singers,
    tags: [...updated.tags],
  };
  dummySongs[index] = song;
  return clone(song);
}

export function deleteDummySong(id: string): boolean {
  const index = dummySongs.findIndex((song) => song.id === id);
  if (index < 0) return false;
  dummySongs.splice(index, 1);
  return true;
}
