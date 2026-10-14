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
  normalizeStatus,
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
  });
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

test("isListedSong keeps OK rows and hides anything else", () => {
  assert.equal(isListedSong({ status: "OK" }), true);
  assert.equal(isListedSong({ status: "" }), true);
  assert.equal(isListedSong({}), true);
  assert.equal(isListedSong({ status: "HIDDEN" }), false);
});

test("planSongWrites skips duplicates and keeps provided ids", () => {
  const existing = [{ id: "rExist", name: "妥协", singers: ["en"], status: "OK" }];
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
  const existing = [{ id: "rExist", name: "妥协", singers: ["en"], status: "OK" }];
  const created = createSongRecord(existing, { name: "不将就", singer: "李荣浩" });
  assert.match(created.id, /^r[0-9a-zA-Z]{5}$/);
  assert.equal(created.status, "OK");
  assert.throws(
    () => createSongRecord(existing, { name: "妥协", singers: ["en"] }),
    /already exists/
  );
});

test("updateSongRecord edits fields and can hide a song", () => {
  const existing = [
    { id: "r1", name: "安静", singers: ["周杰伦"], status: "OK" },
    { id: "r2", name: "晴天", singers: ["周杰伦"], status: "OK" },
  ];
  assert.throws(() => applySongPatch(existing[0], {}), /At least one field/);
  assert.deepEqual(updateSongRecord(existing, "r1", { status: "hidden" }), {
    id: "r1",
    name: "安静",
    singers: ["周杰伦"],
    status: "HIDDEN",
  });
  assert.equal(updateSongRecord(existing, "missing", { name: "新歌", singers: ["甲"] }), null);
  assert.throws(
    () => updateSongRecord(existing, "r1", { name: "晴天", singers: ["周杰伦"] }),
    /already exists/
  );
  assert.throws(() => normalizeStatus("DRAFT"), /status must be OK or HIDDEN/);
});

test("rowToSong reads OTS columns and drops incomplete rows", () => {
  const song = rowToSong({
    song_id: "rl72Fm",
    name: "50 Ways to Say Goodbye",
    singers: '["Train"]',
    status: "OK",
  });
  assert.deepEqual(toPublicSong(song), {
    id: "rl72Fm",
    name: "50 Ways to Say Goodbye",
    singers: ["Train"],
  });
  assert.equal(rowToSong({ song_id: "x" }), null);
});
