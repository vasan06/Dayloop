import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

globalThis.window = new EventTarget();
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });

const mock = {
  user: { uid: "alice" },
  uid: "",
  accounts: new Map(),
  account() { return this.accounts.get(this.uid); },
};
globalThis.dayloopSyncTest = mock;
const stubs = {
  firebase: `export const firebaseAuth = { get currentUser() { return globalThis.dayloopSyncTest.user } };`,
  mobileDerived: `export const deriveOffline = async () => null;`,
  mobileIds: `export async function replaceMobileTempId(from, to, completedOpId) {
    const state = globalThis.dayloopSyncTest;
    state.account().queue = state.account().queue.filter((op) => op.op_id !== completedOpId)
      .map((op) => ({ ...op, path: op.path.replace(from, to) }));
  }`,
  mobileData: `
    const state = globalThis.dayloopSyncTest;
    export const isNativeMobile = true;
    export async function activateMobileAccount(uid) {
      state.uid = uid;
      if (!state.accounts.has(uid)) state.accounts.set(uid, { cache: new Map(), cursor: new Map(), queue: [] });
    }
    export const cachedResponse = async (path) => state.account().cache.get(path) ?? null;
    export const saveResponse = async (path, value) => state.account().cache.set(path, value);
    export const removeResponse = async (path) => state.account().cache.delete(path);
    export const getSyncValue = async (key) => state.account().cursor.get(key) ?? null;
    export const setSyncValue = async (key, value) => state.account().cursor.set(key, value);
    export const listConflicts = async () => [];
    export const pendingMutations = async () => state.account().queue.map((op) => ({ ...op }));
    export const saveConflict = async () => {};
    export const removeMutation = async (id) => {
      state.account().queue = state.account().queue.filter((op) => op.op_id !== id);
    };
    export const activeMobileDatabase = () => {};
  `,
};
const bundle = await build({
  absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
  entryPoints: ["src/lib/mobileApi.ts"],
  bundle: true,
  write: false,
  format: "esm",
  plugins: [{
    name: "native-sync-test",
    setup(builder) {
      builder.onResolve({ filter: /^\.\/(firebase|mobileDerived|mobileData|mobileIds)$/ }, ({ path }) => ({
        path: path.slice(2),
        namespace: "sync-test",
      }));
      builder.onLoad({ filter: /.*/, namespace: "sync-test" }, ({ path }) => ({
        contents: stubs[path],
      }));
    },
  }],
});
const source = Buffer.from(bundle.outputFiles[0].text).toString("base64");
const { mobileRequest, resetMobileWorkspace, syncMobileChanges } = await import("data:text/javascript;base64," + source);

beforeEach(() => {
  mock.user = { uid: "alice" };
  mock.accounts.clear();
  resetMobileWorkspace();
});

function requestError(status) {
  return Object.assign(new Error("Request failed"), { name: "ApiRequestError", status });
}

test("mobile cache only substitutes for transport failures", async () => {
  await mobileRequest("/tasks", {}, async () => ({ items: [{ id: "saved" }] }));
  for (const status of [401, 403, 404, 500]) {
    await assert.rejects(mobileRequest("/tasks", {}, async () => { throw requestError(status); }), { status });
  }
  assert.deepEqual(await mobileRequest("/tasks", {}, async () => { throw requestError(0); }), {
    items: [{ id: "saved" }],
  });
});

test("a previous account's in-flight response cannot populate the active account's cache", async () => {
  let complete;
  let notifyStarted;
  const begun = new Promise((resolve) => { notifyStarted = resolve; });
  const previous = mobileRequest("/tasks", {}, () => {
    notifyStarted();
    return new Promise((resolve) => { complete = resolve; });
  });
  await begun;
  mock.user = { uid: "bob" };
  resetMobileWorkspace();
  await mobileRequest("/tasks", {}, async () => ({ items: [{ id: "bobs-task" }] }));
  complete({ items: [{ id: "alices-task" }] });
  await assert.rejects(previous);
  assert.deepEqual(mock.accounts.get("bob").cache.get("/tasks"), { items: [{ id: "bobs-task" }] });
});

test("an empty outbox still pulls remote changes and advances the cursor after refreshing cache", async () => {
  let feedRequested = false;
  await mobileRequest("/profile", {}, async (path) => {
    if (path.startsWith("/sync/changes")) {
      feedRequested = true;
      return { items: [{ entity: "tasks", sequence: 4 }], next_cursor: 4, has_more: false };
    }
    if (path === "/tasks") return { items: [{ id: "changed-on-web" }] };
    return { item: { id: "alice" } };
  });
  await syncMobileChanges();
  assert.equal(feedRequested, true);
  assert.equal(mock.account().cursor.get("server_cursor"), "4");
  assert.deepEqual(mock.account().cache.get("/tasks"), { items: [{ id: "changed-on-web" }] });
});

test("remote changes refresh cached details and evict details for deleted records", async () => {
  await mobileRequest("/profile", {}, async () => ({ item: { id: "alice" } }));
  const account = mock.account();
  account.cache.set("/habits", { items: [{ id: "deleted" }, { id: "updated" }] });
  account.cache.set("/habits/deleted/entries", { items: [{ id: "old" }] });
  account.cache.set("/habits/updated/entries", { items: [{ id: "old" }] });
  const remoteEntries = { items: [{ id: "new" }] };
  await mobileRequest("/profile", {}, async (path) => {
    if (path.startsWith("/sync/changes")) {
      return { items: [{ entity: "habit_entries", sequence: 5 }], next_cursor: 5, has_more: false };
    }
    if (path === "/habits") return { items: [{ id: "updated" }] };
    if (path === "/habits/updated/entries") return remoteEntries;
    return { item: { id: "alice" } };
  });
  await syncMobileChanges();
  assert.equal(account.cache.has("/habits/deleted/entries"), false);
  assert.deepEqual(account.cache.get("/habits/updated/entries"), remoteEntries);
});

test("an incomplete refresh leaves the feed cursor available for retry", async () => {
  let available = false;
  const requests = [];
  await mobileRequest("/profile", {}, async (path) => {
    if (path.startsWith("/sync/changes")) {
      requests.push(path);
      return { items: [{ entity: "tasks", sequence: 6 }], next_cursor: 6, has_more: false };
    }
    if (path === "/tasks" && !available) throw requestError(0);
    return { items: [] };
  });
  await syncMobileChanges();
  assert.equal(mock.account().cursor.has("server_cursor"), false);
  available = true;
  await syncMobileChanges();
  assert.deepEqual(requests, ["/sync/changes?after=0&limit=200&after_tx=0&after_sequence=0", "/sync/changes?after=0&limit=200&after_tx=0&after_sequence=0"]);
  assert.equal(mock.account().cursor.get("server_cursor"), "6");
});

test("transaction cursors replay separately from legacy cursors and preserve exact offsets", async () => {
  const requests = [];
  await mobileRequest("/profile", {}, async (path) => {
    if (!path.startsWith("/sync/changes")) return { item: { id: "alice" } };
    requests.push(Object.fromEntries(new URL(path, "https://example.test").searchParams));
    return {
      items: [],
      next_transaction: "9007199254740993",
      next_sequence: "9007199254740995",
      has_more: false,
    };
  });
  mock.account().cursor.set("server_cursor", "25");
  await syncMobileChanges();
  await syncMobileChanges();
  assert.equal(requests[0].after, "25");
  assert.equal(requests[0].after_tx, "0");
  assert.equal(requests[0].after_sequence, "0");
  assert.equal(requests[1].after_tx, "9007199254740993");
  assert.equal(requests[1].after_sequence, "9007199254740995");
  assert.equal(mock.account().cursor.get("server_cursor"), "25");
});

test("resolving a conflict after an account switch cannot modify the new database", async () => {
  let finishQuery;
  let caughtQuery;
  const queryStarted = new Promise((resolve) => { caughtQuery = resolve; });
  const first = {
    query: async () => {
      caughtQuery();
      return new Promise((resolve) => { finishQuery = resolve; });
    },
    run: async () => {},
    executeSet: async () => {},
    open: async () => {},
    execute: async () => {},
  };
  const second = { ...first };
  const newWrites = [];
  second.run = async (...args) => { newWrites.push(args); };
  second.executeSet = second.run;
  const databases = [first, second];
  globalThis.dayloopSyncSqliteTest = databases;
  const dataBundle = await build({
    absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
    entryPoints: ["src/lib/mobileData.ts"],
    bundle: true,
    write: false,
    format: "esm",
    plugins: [{
      name: "native-conflict-test",
      setup(builder) {
        builder.onResolve({ filter: /^@capacitor/ }, ({ path }) => ({ path, namespace: "sqlite-test" }));
        builder.onLoad({ filter: /.*/, namespace: "sqlite-test" }, ({ path }) => ({
          contents: path === "@capacitor/core"
            ? "export const Capacitor = { isNativePlatform: () => true };"
            : `export const CapacitorSQLite = {};
               export class SQLiteConnection {
                 async createConnection() { return globalThis.dayloopSyncSqliteTest.shift() }
                 async closeConnection() {}
               }`,
        }));
      },
    }],
  });
  const source = Buffer.from(dataBundle.outputFiles[0].text).toString("base64");
  const { activateMobileAccount, resolveConflict } = await import("data:text/javascript;base64," + source);
  await activateMobileAccount("alice");
  const resolving = resolveConflict("edit-1", "local");
  await queryStarted;
  await activateMobileAccount("bob");
  finishQuery({ values: [{ op_id: "edit-1", path: "/tasks/record", base: null, local: null, remote: null }] });
  await assert.rejects(resolving, /account changed/);
  assert.deepEqual(newWrites, []);
});

test("a queued edit uses the server ID assigned to its queued create", async () => {
  const mutations = [];
  await mobileRequest("/profile", {}, async (path, init) => {
    if (init?.method) mutations.push(path);
    if (path === "/tasks" && init?.method === "POST") return { item: { id: "server-id" } };
    if (path === "/tasks/server-id") return { item: { id: "server-id", title: "edited" } };
    if (path.startsWith("/sync/changes")) return { items: [], next_cursor: 0, has_more: false };
    return { item: { id: "alice" } };
  });
  const queue = mock.account().queue;
  queue.push(
    { op_id: "create", method: "POST", path: "/tasks", body: "{}", base: '{"__temp_id":"temp-id"}' },
    { op_id: "edit", method: "PATCH", path: "/tasks/temp-id", body: '{"title":"edited"}', base: null },
  );
  await syncMobileChanges();
  assert.deepEqual(mutations, ["/tasks", "/tasks/server-id"]);
  assert.deepEqual(mock.account().queue, []);
});

test("rekeying cache and dependent edits removes the completed create in one SQLite transaction", async () => {
  const batches = [];
  globalThis.dayloopRekeyTest = {
    async query(sql) {
      if (sql.includes("response_cache")) return { values: [
        { path: "/tasks/temp-id/notes", payload: '{"task_id":"temp-id"}', fetched_at: "old" },
      ] };
      return { values: [
        { op_id: "create", path: "/tasks", body: "{}", base: '{"__temp_id":"temp-id"}' },
        { op_id: "edit", path: "/tasks/temp-id", body: '{"parent_task_id":"temp-id"}', base: null },
      ] };
    },
    async run() { assert.fail("A rekey must write atomically"); },
    async executeSet(writes, transaction) { batches.push({ writes, transaction }); },
  };
  const rekeyBundle = await build({
    absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
    entryPoints: ["src/lib/mobileIds.ts"],
    bundle: true,
    write: false,
    format: "esm",
    plugins: [{
      name: "native-rekey-test",
      setup(builder) {
        builder.onResolve({ filter: /^\.\/mobileData$/ }, () => ({ path: "db", namespace: "rekey-test" }));
        builder.onLoad({ filter: /.*/, namespace: "rekey-test" }, () => ({
          contents: "export const activeMobileDatabase = () => globalThis.dayloopRekeyTest;",
        }));
      },
    }],
  });
  const source = Buffer.from(rekeyBundle.outputFiles[0].text).toString("base64");
  const { replaceMobileTempId } = await import("data:text/javascript;base64," + source);
  await replaceMobileTempId("temp-id", "server-id", "create");
  assert.equal(batches.length, 1);
  assert.equal(batches[0].transaction, true);
  assert.deepEqual(batches[0].writes.map((entry) => entry.values), [
    ["/tasks/temp-id/notes"],
    ["/tasks/server-id/notes", '{"task_id":"server-id"}', "old"],
    ["/tasks/server-id", '{"parent_task_id":"server-id"}', null, "edit"],
    ["create"],
  ]);
});

test("a successful mobile delete removes cached child resources immediately", async () => {
  await mobileRequest("/tasks", {}, async () => ({ items: [{ id: "removed" }] }));
  const cache = mock.account().cache;
  cache.set("/tasks/removed/notes", { items: [{ text: "old data" }] });
  cache.set("/tasks/removed/subtasks", { items: [{ id: "subtask" }] });
  await mobileRequest("/tasks/removed", { method: "DELETE" }, async () => undefined);
  assert.equal(cache.has("/tasks/removed/notes"), false);
  assert.equal(cache.has("/tasks/removed/subtasks"), false);
  assert.deepEqual(cache.get("/tasks"), { items: [] });
});
