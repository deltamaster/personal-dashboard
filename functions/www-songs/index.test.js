const test = require("node:test");
const assert = require("node:assert/strict");
const { handler, listSongs } = require("./index");

test("handler rejects writes before touching OTS", async () => {
  const response = await handler(
    JSON.stringify({ requestContext: { http: { method: "POST", path: "/api/songs" } } })
  );
  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), { error: "method not allowed" });
});

test("handler returns 500 when OTS is not configured", async () => {
  const previous = process.env.OTS_ENDPOINT;
  delete process.env.OTS_ENDPOINT;
  delete process.env.OTS_INSTANCE_NAME;
  try {
    const response = await handler(JSON.stringify({ requestContext: { http: { method: "GET" } } }));
    assert.equal(response.statusCode, 500);
    assert.equal(JSON.parse(response.body).error, "song list unavailable");
  } finally {
    if (previous !== undefined) process.env.OTS_ENDPOINT = previous;
  }
});

test("listSongs follows the range cursor and omits hidden rows", async () => {
  const pages = [
    {
      rows: [
        {
          primaryKey: [{ name: "song_id", value: "a" }],
          attributes: [
            { columnName: "name", columnValue: "甲" },
            { columnName: "singers", columnValue: '["歌手"]' },
            { columnName: "status", columnValue: "OK" },
          ],
        },
        {
          primaryKey: [{ name: "song_id", value: "b" }],
          attributes: [
            { columnName: "name", columnValue: "乙" },
            { columnName: "singers", columnValue: '["隐藏"]' },
            { columnName: "status", columnValue: "HIDDEN" },
          ],
        },
      ],
      nextStartPrimaryKey: [{ name: "song_id", value: "c" }],
    },
    {
      rows: [
        {
          primaryKey: [{ name: "song_id", value: "c" }],
          attributes: [
            { columnName: "name", columnValue: "丙" },
            { columnName: "singers", columnValue: '["丙歌手"]' },
            { columnName: "status", columnValue: "OK" },
          ],
        },
      ],
    },
  ];
  const calls = [];
  const client = {
    getRange(params, cb) {
      calls.push(params.inclusiveStartPrimaryKey);
      cb(null, pages.shift());
    },
  };

  const songs = await listSongs(client);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], [{ song_id: "c" }]);
  assert.deepEqual(songs, [
    { id: "a", name: "甲", singers: ["歌手"] },
    { id: "c", name: "丙", singers: ["丙歌手"] },
  ]);
});
