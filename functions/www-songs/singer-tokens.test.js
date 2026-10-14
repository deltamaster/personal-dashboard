const test = require("node:test");
const assert = require("node:assert/strict");
const { consumeSingerDraft, splitSingerText, withCommittedDraft } = require("./singer-tokens");

test("splitSingerText trims and splits dunhao, comma, slash, and semicolon", () => {
  assert.deepEqual(splitSingerText("  周杰伦 / 方文山; 陈奕迅、王力宏 "), [
    "周杰伦",
    "方文山",
    "陈奕迅",
    "王力宏",
  ]);
  assert.deepEqual(splitSingerText("A；B"), ["A", "B"]);
  assert.deepEqual(splitSingerText(" / ; "), []);
});

test("consumeSingerDraft turns completed separator-delimited names into chips", () => {
  assert.deepEqual(consumeSingerDraft("周杰伦/"), { chips: ["周杰伦"], draft: "" });
  assert.deepEqual(consumeSingerDraft("  周杰伦 / 方文山"), {
    chips: ["周杰伦"],
    draft: "方文山",
  });
  assert.deepEqual(consumeSingerDraft("周杰伦;方文山；"), {
    chips: ["周杰伦", "方文山"],
    draft: "",
  });
  assert.deepEqual(consumeSingerDraft("  Jay"), { chips: [], draft: "Jay" });
});

test("withCommittedDraft trims the unfinished name and skips a blank draft", () => {
  assert.deepEqual(withCommittedDraft(["周杰伦"], "  方文山  "), ["周杰伦", "方文山"]);
  assert.deepEqual(withCommittedDraft(["周杰伦"], "   "), ["周杰伦"]);
});
