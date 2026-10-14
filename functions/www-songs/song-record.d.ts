export const TABLE: string;
export const PK: string;

export function parseSingers(value: unknown): string[];

export function normalizeSongInput(song: {
  name?: string;
  singers?: unknown;
  singer?: string;
  id?: string;
}): { id: string; name: string; singers: string[] };

export function songIdentity(name: string, singers: string[]): string;

export function sameSingers(a: string[], b: string[]): boolean;

export function generateId(existing: Set<string>): string;

export function isListedSong(song: { status?: string }): boolean;

export type SongRecord = {
  id: string;
  name: string;
  singers: string[];
  status: string;
};

export function rowToSong(raw: Record<string, unknown>): SongRecord | null;

export function toPublicSong(song: SongRecord): { id: string; name: string; singers: string[] };

export function planSongWrites(
  existing: SongRecord[],
  incoming: { id: string; name: string; singers: string[] }[]
): { added: SongRecord[]; skipped: { id: string; name: string; singers: string[]; reason: string }[] };

export function normalizeStatus(status: unknown): "OK" | "HIDDEN";

export function createSongRecord(
  existing: SongRecord[],
  input: { name?: string; singers?: unknown; singer?: string; id?: string }
): SongRecord;

export function applySongPatch(
  current: SongRecord,
  patch: { name?: string; singers?: unknown; singer?: string; status?: string }
): SongRecord;

export function updateSongRecord(
  existing: SongRecord[],
  id: string,
  patch: { name?: string; singers?: unknown; singer?: string; status?: string }
): SongRecord | null;
