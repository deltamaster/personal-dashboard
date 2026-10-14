const crypto = require("crypto");
const { splitSingerText } = require("./singer-tokens");

const TABLE = "www_songs";
const PK = "song_id";
const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_TAGS = 16;
const MAX_TAG_LENGTH = 32;
// Tags that remove a song from the public list. Other tags are stored and ignored here.
const UNLISTED_TAGS = new Set(["hidden", "learning"]);

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
  return splitSingerText(text);
}

function normalizeTag(value) {
  const tag = String(value).trim().toLowerCase().replace(/\s+/g, "-");
  if (!tag || tag === "public") return "";
  if (tag.length > MAX_TAG_LENGTH) {
    throw new Error("tag is too long");
  }
  if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(tag)) {
    throw new Error("tag must be a word");
  }
  return tag;
}

function normalizeTags(value) {
  let items = [];
  if (Array.isArray(value)) {
    items = value;
  } else if (value == null || value === "") {
    items = [];
  } else {
    const text = String(value).trim();
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        items = Array.isArray(parsed) ? parsed : text.split(/[,，]/);
      } catch {
        items = text.split(/[,，]/);
      }
    } else {
      items = text.split(/[,，]/);
    }
  }
  const tags = [];
  const seen = new Set();
  for (const item of items) {
    const tag = normalizeTag(item);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  if (tags.length > MAX_TAGS) {
    throw new Error("too many tags");
  }
  return tags;
}

function tagsFromRaw(raw) {
  if (raw.tags != null && raw.tags !== "") return normalizeTags(raw.tags);
  const status = String(raw.status || "").trim().toLowerCase();
  return status === "hidden" ? ["hidden"] : [];
}

function songTags(song) {
  if (Array.isArray(song?.tags)) return song.tags;
  return tagsFromRaw(song ?? {});
}

function normalizeSongInput(song) {
  const name = String(song.name || "").trim();
  const singers = parseSingers(song.singers != null ? song.singers : song.singer);
  const id = song.id ? String(song.id).trim() : "";
  const hasTags = song.tags != null || song.tag != null;
  const tags = hasTags ? normalizeTags(song.tags != null ? song.tags : song.tag) : [];
  if (!name || !singers.length) {
    throw new Error(`Each song needs a name and singer. Got: ${JSON.stringify(song)}`);
  }
  return { id, name, singers, tags };
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
  return !songTags(song).some((tag) => UNLISTED_TAGS.has(tag));
}

function storedStatus(song) {
  return isListedSong(song) ? "OK" : "HIDDEN";
}

function rowToSong(raw) {
  const id = raw.song_id != null ? String(raw.song_id).trim() : "";
  const name = raw.name != null ? String(raw.name).trim() : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    singers: parseSingers(raw.singers),
    tags: tagsFromRaw(raw),
  };
}

function toPublicSong(song) {
  return { id: song.id, name: song.name, singers: song.singers };
}

function tagsAfterStatus(currentTags, status) {
  const value = String(status == null || status === "" ? "OK" : status).trim().toUpperCase();
  if (value === "HIDDEN") {
    return normalizeTags([...currentTags, "hidden"]);
  }
  if (value === "OK") {
    return currentTags.filter((tag) => tag !== "hidden");
  }
  throw new Error("status must be OK or HIDDEN");
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
  const hasTags =
    Object.prototype.hasOwnProperty.call(patch, "tags") || Object.prototype.hasOwnProperty.call(patch, "tag");
  const hasStatus = Object.prototype.hasOwnProperty.call(patch, "status");
  if (!hasName && !hasSingers && !hasTags && !hasStatus) {
    throw new Error("At least one field is required");
  }
  const name = hasName ? patch.name : current.name;
  const singers = hasSingers ? (patch.singers != null ? patch.singers : patch.singer) : current.singers;
  const normalized = normalizeSongInput({ id: current.id, name, singers });
  const currentTags = songTags(current);
  let tags = currentTags;
  if (hasTags) {
    tags = normalizeTags(patch.tags != null ? patch.tags : patch.tag);
  } else if (hasStatus) {
    tags = tagsAfterStatus(currentTags, patch.status);
  }
  return { id: current.id, name: normalized.name, singers: normalized.singers, tags };
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
    added.push({
      id,
      name: song.name,
      singers: song.singers,
      tags: normalizeTags(song.tags),
    });
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
  normalizeTags,
  isListedSong,
  storedStatus,
  rowToSong,
  toPublicSong,
  planSongWrites,
  createSongRecord,
  applySongPatch,
  updateSongRecord,
};
