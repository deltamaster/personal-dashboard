const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseSingers,
  normalizeSongInput,
  songIdentity,
  generateId,
  isListedSong,
  rowToSong,
  toPublicSong,
  planSongWrites,
  normalizeTags,
  storedStatus,
  createSongRecord,
  applySongPatch,
  updateSongRecord,
} = require("./song-record");

test("parseSingers splits Chinese and ASCII separators and JSON arrays", () => {
  assert.deepEqual(parseSingers("en、杨千嬅"), ["en", "杨千嬅"]);
  assert.deepEqual(parseSingers("A, B/C"), ["A", "B", "C"]);
  assert.deepEqual(parseSingers('["李荣浩"]'), ["李荣浩"]);
});

test("normalizeSongInput maps singer to singers", () => {
  assert.deepEqual(normalizeSongInput({ name: " 妥协 ", singer: "en" }), {
    id: "",
    name: "妥协",
    singers: ["en"],
    tags: [],
  });
  assert.deepEqual(normalizeSongInput({ name: "晴天", singer: "周杰伦", tags: ["Learning", "public", "learning"] }), {
    id: "",
    name: "晴天",
    singers: ["周杰伦"],
    tags: ["learning"],
  });
});

test("normalizeTags keeps unknown tags and drops the implicit public tag", () => {
  assert.deepEqual(normalizeTags(["public", "Hidden", "learning", "hidden", "featured"]), [
    "hidden",
    "learning",
    "featured",
  ]);
  assert.deepEqual(normalizeTags(["has space"]), ["has-space"]);
  assert.throws(() => normalizeTags(["bad/tag"]), /tag must be a word/);
});

test("normalizeSongInput rejects a song without a singer", () => {
  assert.throws(() => normalizeSongInput({ name: "妥协" }));
});

test("songIdentity treats singer order as part of the key", () => {
  assert.notEqual(songIdentity("歌", ["A", "B"]), songIdentity("歌", ["B", "A"]));
});

test("generateId is unique, prefixed, and six characters", () => {
  const existing = new Set(["rAAAAA"]);
  const id = generateId(existing);
  assert.match(id, /^r[0-9a-zA-Z]{5}$/);
  assert.equal(existing.has(id), true);
  assert.notEqual(id, "rAAAAA");
});

test("isListedSong hides hidden and learning tags and keeps other tags public", () => {
  assert.equal(isListedSong({ tags: [] }), true);
  assert.equal(isListedSong({}), true);
  assert.equal(isListedSong({ status: "OK" }), true);
  assert.equal(isListedSong({ status: "HIDDEN" }), false);
  assert.equal(isListedSong({ tags: ["learning"] }), false);
  assert.equal(isListedSong({ tags: ["hidden"] }), false);
  assert.equal(isListedSong({ tags: ["featured"] }), true);
  assert.equal(storedStatus({ tags: ["learning"] }), "HIDDEN");
  assert.equal(storedStatus({ tags: [] }), "OK");
});

test("planSongWrites skips duplicates and keeps provided ids", () => {
  const existing = [{ id: "rExist", name: "妥协", singers: ["en"], tags: [] }];
  const planned = planSongWrites(existing, [
    { id: "", name: "妥协", singers: ["en"] },
    { id: "rNew111", name: "不将就", singers: ["李荣浩"] },
  ]);
  assert.equal(planned.skipped.length, 1);
  assert.equal(planned.added.length, 1);
  assert.equal(planned.added[0].id, "rNew111");
  assert.throws(() => planSongWrites(existing, [{ id: "rExist", name: "另一首", singers: ["甲"] }]));
});

test("createSongRecord rejects a duplicate name and singer list", () => {
  const existing = [{ id: "rExist", name: "妥协", singers: ["en"], tags: [] }];
  const created = createSongRecord(existing, { name: "不将就", singer: "李荣浩", tag: "learning" });
  assert.match(created.id, /^r[0-9a-zA-Z]{5}$/);
  assert.deepEqual(created.tags, ["learning"]);
  assert.throws(
    () => createSongRecord(existing, { name: "妥协", singers: ["en"] }),
    /already exists/
  );
});

test("updateSongRecord edits fields and can tag a song", () => {
  const existing = [
    { id: "r1", name: "安静", singers: ["周杰伦"], tags: [] },
    { id: "r2", name: "晴天", singers: ["周杰伦"], tags: ["learning"] },
  ];
  assert.throws(() => applySongPatch(existing[0], {}), /At least one field/);
  assert.deepEqual(updateSongRecord(existing, "r1", { tags: ["learning", "hidden"] }), {
    id: "r1",
    name: "安静",
    singers: ["周杰伦"],
    tags: ["learning", "hidden"],
  });
  assert.deepEqual(updateSongRecord(existing, "r2", { status: "OK" }).tags, ["learning"]);
  assert.deepEqual(updateSongRecord(existing, "r1", { status: "hidden" }).tags, ["hidden"]);
  assert.equal(updateSongRecord(existing, "missing", { name: "新歌", singers: ["甲"] }), null);
  assert.throws(
    () => updateSongRecord(existing, "r1", { name: "晴天", singers: ["周杰伦"] }),
    /already exists/
  );
  assert.throws(() => updateSongRecord(existing, "r1", { status: "DRAFT" }), /status must be OK or HIDDEN/);
});

test("rowToSong reads OTS columns and drops incomplete rows", () => {
  const song = rowToSong({
    song_id: "rl72Fm",
    name: "50 Ways to Say Goodbye",
    singers: '["Train"]',
    tags: '["learning"]',
    status: "OK",
  });
  assert.deepEqual(song.tags, ["learning"]);
  assert.equal(isListedSong(song), false);
  assert.deepEqual(toPublicSong(song), {
    id: "rl72Fm",
    name: "50 Ways to Say Goodbye",
    singers: ["Train"],
  });
  assert.deepEqual(rowToSong({ song_id: "old", name: "旧", singers: "[]", status: "HIDDEN" }).tags, ["hidden"]);
  assert.deepEqual(rowToSong({ song_id: "plain", name: "公开", singers: "[]" }).tags, []);
  assert.equal(rowToSong({ song_id: "x" }), null);
});
