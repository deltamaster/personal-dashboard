const test = require("node:test");
const assert = require("node:assert/strict");
const { adjustedLength, columnSpan, sortSongs, filterSongs } = require("./songs-logic");

test("adjustedLength counts non-ASCII as two", () => {
  assert.equal(adjustedLength("AB"), 2);
  assert.equal(adjustedLength("歌"), 2);
  assert.equal(adjustedLength("A歌"), 3);
});

test("sortSongs orders by display width", () => {
  const sorted = sortSongs([
    { name: "阿拉斯加海湾", singers: [] },
    { name: "Hi", singers: [] },
    { name: "歌", singers: [] },
  ]);
  assert.deepEqual(
    sorted.map((song) => song.name),
    ["Hi", "歌", "阿拉斯加海湾"]
  );
});

test("columnSpan grows with the title and caps at 8", () => {
  assert.equal(columnSpan("Hi"), 2);
  assert.equal(columnSpan("x".repeat(40)), 8);
});

test("filterSongs matches name or singer and ignores case", () => {
  const songs = [
    { name: "妥协", singers: ["en"] },
    { name: "Hello", singers: ["Adele"] },
  ];
  assert.deepEqual(
    filterSongs(songs, "ADE").map((song) => song.name),
    ["Hello"]
  );
  assert.deepEqual(
    filterSongs(songs, "妥").map((song) => song.name),
    ["妥协"]
  );
  assert.equal(filterSongs(songs, "   ").length, 2);
});
