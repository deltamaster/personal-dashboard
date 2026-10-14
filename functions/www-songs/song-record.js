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
};
