const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRequest, jsonResponse } = require("./http");

test("parseRequest reads the FC HTTP trigger method", () => {
  const event = Buffer.from(
    JSON.stringify({ requestContext: { http: { method: "get", path: "/api/songs" } } })
  );
  assert.deepEqual(parseRequest(event), { method: "GET" });
});

test("parseRequest defaults a bare invoke to GET", () => {
  assert.deepEqual(parseRequest(""), { method: "GET" });
  assert.deepEqual(parseRequest({}), { method: "GET" });
});

test("jsonResponse is uncached JSON", () => {
  const response = jsonResponse(200, [{ id: "a", name: "歌", singers: ["甲"] }]);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(response.body), [{ id: "a", name: "歌", singers: ["甲"] }]);
});
