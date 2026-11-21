import assert from "node:assert/strict";
import test from "node:test";
import { Autosave } from "../src/lib/autosave.ts";

test("a pending write cannot acknowledge or overwrite a later edit", async () => {
  const writes = [];
  const gates = [];
  const queue = new Autosave(async (draft) => {
    writes.push(draft);
    await new Promise((resolve) => gates.push(resolve));
  });
  queue.edit("first");
  const saving = queue.flush();
  queue.edit("second");
  queue.edit("latest");
  const leaving = queue.flush();
  assert.deepEqual(writes, ["first"]);
  gates.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(writes, ["first", "latest"]);
  gates.shift()();
  await Promise.all([saving, leaving]);
  assert.equal(queue.status, "saved");
  assert.equal(queue.draft, undefined);
});

test("a failed write keeps the latest draft for an explicit retry", async () => {
  let failing = true;
  const queue = new Autosave(async () => { if (failing) throw new Error("offline"); });
  queue.edit("changes");
  await queue.flush();
  assert.equal(queue.status, "error");
  assert.equal(queue.draft, "changes");
  failing = false;
  await queue.flush();
  assert.equal(queue.status, "saved");
});
