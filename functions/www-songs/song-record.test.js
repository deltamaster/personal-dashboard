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
