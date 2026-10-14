const crypto = require("crypto");

const TABLE = "www_songs";
const PK = "song_id";
const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function parseSingers(value) {
  if (Array.isArray(value)) {
    return value.map((singer) => String(singer).trim()).filter(Boolean);
  }
  if (value == null || value === "") return [];
  const text = String(value).trim();
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((singer) => String(singer).trim()).filter(Boolean);
      }
    } catch {
      /* plain text below */
    }
  }
  return text
    .split(/[、,/]/)
    .map((singer) => singer.trim())
    .filter(Boolean);
}

function normalizeSongInput(song) {
  const name = String(song.name || "").trim();
  const singers = parseSingers(song.singers != null ? song.singers : song.singer);
  const id = song.id ? String(song.id).trim() : "";
  if (!name || !singers.length) {
    throw new Error(`Each song needs a name and singer. Got: ${JSON.stringify(song)}`);
  }
  return { id, name, singers };
}

function songIdentity(name, singers) {
  return `${name}\n${singers.join("\n")}`;
}

function sameSingers(a, b) {
  return a.length === b.length && a.every((singer, index) => singer === b[index]);
}

function generateId(existing) {
  let id;
  do {
    id = "r";
    const bytes = crypto.randomBytes(5);
    for (let i = 0; i < 5; i++) {
      id += ID_CHARS[bytes[i] % ID_CHARS.length];
    }
  } while (existing.has(id));
  existing.add(id);
  return id;
}

function isListedSong(song) {
  const status = String(song.status || "OK").trim().toUpperCase();
  return status === "" || status === "OK";
}

function rowToSong(raw) {
  const id = raw.song_id != null ? String(raw.song_id).trim() : "";
  const name = raw.name != null ? String(raw.name).trim() : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    singers: parseSingers(raw.singers),
    status: raw.status != null ? String(raw.status) : "OK",
  };
}

function toPublicSong(song) {
  return { id: song.id, name: song.name, singers: song.singers };
}

function normalizeStatus(status) {
  const value = String(status == null || status === "" ? "OK" : status).trim().toUpperCase();
  if (value !== "OK" && value !== "HIDDEN") {
    throw new Error("status must be OK or HIDDEN");
  }
  return value;
}

function createSongRecord(existing, input) {
  const normalized = normalizeSongInput(input);
  const planned = planSongWrites(existing, [normalized]);
  if (planned.added.length !== 1) {
    throw new Error("A song with that name and singers already exists");
  }
  return planned.added[0];
}

function applySongPatch(current, patch) {
  const hasName = Object.prototype.hasOwnProperty.call(patch, "name");
  const hasSingers =
    Object.prototype.hasOwnProperty.call(patch, "singers") ||
    Object.prototype.hasOwnProperty.call(patch, "singer");
  const hasStatus = Object.prototype.hasOwnProperty.call(patch, "status");
  if (!hasName && !hasSingers && !hasStatus) {
    throw new Error("At least one field is required");
  }
  const name = hasName ? patch.name : current.name;
  const singers = hasSingers ? (patch.singers != null ? patch.singers : patch.singer) : current.singers;
  const normalized = normalizeSongInput({ id: current.id, name, singers });
  const status = hasStatus ? normalizeStatus(patch.status) : normalizeStatus(current.status || "OK");
  return { id: current.id, name: normalized.name, singers: normalized.singers, status };
}

function updateSongRecord(existing, id, patch) {
  const current = existing.find((song) => song.id === id);
  if (!current) return null;
  const next = applySongPatch(current, patch);
  const identity = songIdentity(next.name, next.singers);
  const duplicate = existing.find(
    (song) => song.id !== id && songIdentity(song.name, song.singers) === identity
  );
  if (duplicate) {
    throw new Error("A song with that name and singers already exists");
  }
  return next;
}

function planSongWrites(existing, incoming) {
  const ids = new Set(existing.map((song) => song.id));
  const identities = new Set(existing.map((song) => songIdentity(song.name, song.singers)));
  const added = [];
  const skipped = [];

  for (const song of incoming) {
    const identity = songIdentity(song.name, song.singers);
    if (identities.has(identity)) {
      skipped.push({ id: song.id, name: song.name, singers: song.singers, reason: "duplicate name+singers" });
      continue;
    }
    if (song.id && ids.has(song.id)) {
      throw new Error(`Song id already exists: ${song.id}`);
    }
    const id = song.id || generateId(ids);
    ids.add(id);
    identities.add(identity);
    added.push({ id, name: song.name, singers: song.singers, status: "OK" });
  }

  return { added, skipped };
}

module.exports = {
  TABLE,
  PK,
  parseSingers,
  normalizeSongInput,
  songIdentity,
  sameSingers,
  generateId,
  isListedSong,
  rowToSong,
  toPublicSong,
  planSongWrites,
  normalizeStatus,
  createSongRecord,
  applySongPatch,
  updateSongRecord,
};
