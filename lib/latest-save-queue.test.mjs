import assert from "node:assert/strict";
import test from "node:test";
import { createLatestSaveQueue } from "./latest-save-queue.ts";

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test("synchronous pushes save only the latest value", async () => {
  const saved = [];
  const queue = createLatestSaveQueue(async (value) => {
    saved.push([...value]);
  });

  queue.push(["learning"]);
  queue.push(["learning", "hidden"]);
  await queue.whenIdle();

  assert.deepEqual(saved, [["learning", "hidden"]]);
});

test("an in-flight save is followed by the newest tag list", async () => {
  const saved = [];
  const first = deferred();
  const queue = createLatestSaveQueue(async (value) => {
    saved.push([...value]);
    if (saved.length === 1) await first.promise;
  });

  queue.push(["learning"]);
  await Promise.resolve();
  queue.push(["learning", "hidden"]);
  assert.deepEqual(saved, [["learning"]]);

  first.resolve();
  await queue.whenIdle();

  assert.deepEqual(saved, [["learning"], ["learning", "hidden"]]);
});

test("a failed save still writes a newer value and does not report the abandoned error", async () => {
  const saved = [];
  const errors = [];
  const first = deferred();
  const queue = createLatestSaveQueue(
    async (value) => {
      if (value.length === 1) {
        await first.promise;
        throw new Error("stale write failed");
      }
      saved.push([...value]);
    },
    { attempts: 1, onError: (error) => errors.push(error) }
  );

  queue.push(["learning"]);
  await Promise.resolve();
  queue.push(["learning", "hidden"]);
  first.resolve();
  await queue.whenIdle();

  assert.deepEqual(saved, [["learning", "hidden"]]);
  assert.deepEqual(errors, []);
});

test("the latest value reports an error after its attempts are used", async () => {
  const errors = [];
  const queue = createLatestSaveQueue(
    async () => {
      throw new Error("offline");
    },
    {
      attempts: 2,
      onError: (error) => errors.push(error instanceof Error ? error.message : "unknown"),
    }
  );

  queue.push(["hidden"]);
  await queue.whenIdle();

  assert.deepEqual(errors, ["offline"]);
});
