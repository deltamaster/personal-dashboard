export const TABLE: string;
export const PK: string;

export function parseSingers(value: unknown): string[];

export function normalizeTags(value: unknown): string[];

export function normalizeSongInput(song: {
  name?: string;
  singers?: unknown;
  singer?: string;
  id?: string;
  tags?: unknown;
  tag?: unknown;
}): { id: string; name: string; singers: string[]; tags: string[] };

export function songIdentity(name: string, singers: string[]): string;

export function sameSingers(a: string[], b: string[]): boolean;

export function generateId(existing: Set<string>): string;

export function isListedSong(song: { tags?: string[]; status?: string }): boolean;

export function storedStatus(song: { tags?: string[]; status?: string }): "OK" | "HIDDEN";

export type SongRecord = {
  id: string;
  name: string;
  singers: string[];
  tags: string[];
};

export function rowToSong(raw: Record<string, unknown>): SongRecord | null;

export function toPublicSong(song: SongRecord): { id: string; name: string; singers: string[] };

export function planSongWrites(
  existing: SongRecord[],
  incoming: { id: string; name: string; singers: string[]; tags?: unknown }[]
): { added: SongRecord[]; skipped: { id: string; name: string; singers: string[]; reason: string }[] };

export function createSongRecord(
  existing: SongRecord[],
  input: { name?: string; singers?: unknown; singer?: string; id?: string; tags?: unknown; tag?: unknown }
): SongRecord;

export function applySongPatch(
  current: SongRecord,
  patch: { name?: string; singers?: unknown; singer?: string; tags?: unknown; tag?: unknown; status?: string }
): SongRecord;

export function updateSongRecord(
  existing: SongRecord[],
  id: string,
  patch: { name?: string; singers?: unknown; singer?: string; tags?: unknown; tag?: unknown; status?: string }
): SongRecord | null;
