import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";

export const isNativeMobile = Capacitor.isNativePlatform();
export type PendingMutation = {
  op_id: string; method: string; path: string; body: string | null; base: string | null; created_at: string;
};
export type SyncConflict = {
  op_id: string; path: string; base: string | null; local: string | null; remote: string | null;
};
const sqlite = new SQLiteConnection(CapacitorSQLite);
let connection: SQLiteDBConnection | null = null;
let activeUid: string | null = null;
let opening: Promise<void> | null = null;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS response_cache (
  path TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_mutations (
  op_id TEXT PRIMARY KEY, method TEXT NOT NULL, path TEXT NOT NULL,
  body TEXT, base TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_conflicts (
  op_id TEXT PRIMARY KEY, path TEXT NOT NULL, base TEXT, local TEXT, remote TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;
function databaseName(uid: string): string {
  // Firebase UID never becomes a filename: hash it to a stable ASCII name.
  let first = 2166136261, second = 5381;
  for (let i = 0; i < uid.length; i++) {
    first = Math.imul(first ^ uid.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ uid.charCodeAt(i);
  }
  return "dayloop_" + (first >>> 0).toString(16) + "_" + (second >>> 0).toString(16);
}
export async function activateMobileAccount(uid: string): Promise<void> {
  if (!isNativeMobile) return;
  if (!uid) throw new Error("Cannot open a mobile database without a signed-in user.");
  if (activeUid === uid && connection) return;
  if (opening) await opening;
  if (activeUid === uid && connection) return;
  opening = (async () => {
    if (connection && activeUid) {
      await sqlite.closeConnection(databaseName(activeUid), false);
      connection = null;
    }
    activeUid = null;
    const name = databaseName(uid);
    const db = await sqlite.createConnection(name, false, "no-encryption", 1, false);
    try {
      await db.open();
      await db.execute(SCHEMA);
      connection = db;
      activeUid = uid;
    } catch (error) {
      await db.close().catch(() => {});
      throw error;
    }
  })();
  try { await opening; } finally { opening = null; }
}
export async function deactivateMobileAccount(): Promise<void> {
  if (opening) await opening;
  if (connection && activeUid) await sqlite.closeConnection(databaseName(activeUid), false);
  connection = null;
  activeUid = null;
}
export function activeMobileDatabase(): SQLiteDBConnection {
  return db();
}
function db(): SQLiteDBConnection {
  if (!connection || !activeUid) throw new Error("Mobile SQLite account is not initialized.");
  return connection;
}
export async function cachedResponse<T>(path: string): Promise<T | null> {
  const result = await db().query("SELECT payload FROM response_cache WHERE path = ?", [path]);
  const record = result.values?.[0] as { payload?: string } | undefined;
  return record?.payload ? JSON.parse(record.payload) as T : null;
}
export async function saveResponse(path: string, payload: unknown): Promise<void> {
  await db().run(
    "INSERT INTO response_cache(path,payload,fetched_at) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at",
    [path, JSON.stringify(payload), new Date().toISOString()],
  );
}
export async function queueMutation(mutation: Omit<PendingMutation, "op_id" | "created_at">): Promise<string> {
  const id = crypto.randomUUID();
  await db().run(
    "INSERT INTO pending_mutations(op_id,method,path,body,base,created_at) VALUES(?,?,?,?,?,?)",
    [id, mutation.method, mutation.path, mutation.body, mutation.base, new Date().toISOString()],
  );
  window.dispatchEvent(new Event("dayloop:mobile-data"));
  return id;
}
export async function pendingMutations(): Promise<PendingMutation[]> {
  const result = await db().query("SELECT * FROM pending_mutations ORDER BY created_at,op_id");
  return (result.values ?? []) as PendingMutation[];
}
export async function removeMutation(opId: string): Promise<void> {
  await db().run("DELETE FROM pending_mutations WHERE op_id=?", [opId]);
  window.dispatchEvent(new Event("dayloop:mobile-data"));
}
export async function saveConflict(conflict: SyncConflict): Promise<void> {
  await db().run(
    "INSERT OR REPLACE INTO sync_conflicts(op_id,path,base,local,remote,created_at) VALUES(?,?,?,?,?,?)",
    [conflict.op_id, conflict.path, conflict.base, conflict.local, conflict.remote, new Date().toISOString()],
  );
  window.dispatchEvent(new Event("dayloop:mobile-data"));
}
export async function listConflicts(): Promise<SyncConflict[]> {
  const result = await db().query("SELECT op_id,path,base,local,remote FROM sync_conflicts ORDER BY created_at");
  return (result.values ?? []) as SyncConflict[];
}
export async function resolveConflict(id: string, keep: "local" | "remote" | "merged", mergedJson?: string): Promise<void> {
  const match = (await listConflicts()).find((item) => item.op_id === id);
  if (!match) throw new Error("Conflict not found");
  if (keep === "remote") {
    if (match.remote) {
      const latest = JSON.parse(match.remote) as unknown;
      const roots = ["/calendar/events","/finance/transactions","/finance/categories",
        "/finance/budgets","/finance/savings","/tasks","/projects","/habits","/notes","/goals","/trackers"];
      const root = roots.find((item) => match.path.startsWith(item + "/"));
      if (root && latest && typeof latest === "object" && "id" in latest) {
        const old = await cachedResponse<{items?: Array<{id:string}>}>(root);
        const updated = (old?.items ?? []).filter((item) => item.id !== (latest as {id:string}).id);
        await saveResponse(root, {items: [...updated,latest]});
      } else await saveResponse(match.path, latest);
    }
    await removeMutation(match.op_id);
  } else {
    if (keep === "merged") {
      if (!mergedJson) throw new Error("Merged data is required");
      const parsed: unknown = JSON.parse(mergedJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Merged data must be an object");
      await db().run("UPDATE pending_mutations SET base=NULL,body=? WHERE op_id=?", [mergedJson,id]);
    } else {
      await db().run("UPDATE pending_mutations SET base=NULL WHERE op_id=?", [id]);
    }
  }
  await db().run("DELETE FROM sync_conflicts WHERE op_id=?", [id]);
  window.dispatchEvent(new Event("dayloop:mobile-data"));
}
export async function setSyncValue(key: string, value: string): Promise<void> {
  await db().run("INSERT OR REPLACE INTO sync_metadata(key,value) VALUES(?,?)", [key,value]);
}
export async function getSyncValue(key: string): Promise<string | null> {
  const result = await db().query("SELECT value FROM sync_metadata WHERE key=?", [key]);
  return (result.values?.[0] as { value?: string } | undefined)?.value ?? null;
}
