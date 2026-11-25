import {
  activateMobileAccount, cachedResponse, getSyncValue, isNativeMobile, listConflicts, pendingMutations,
  removeMutation, removeResponse, saveConflict, saveResponse, setSyncValue, type PendingMutation,
} from "./mobileData";
import { firebaseAuth } from "./firebase";
import { deriveOffline } from "./mobileDerived";

type JsonRecord = Record<string, unknown>;
type RequestTransport = (path: string, init?: RequestInit) => Promise<unknown>;
let transporting: RequestTransport | null = null;
let syncing: Promise<void> | null = null;
let lastSync = 0;
let initializedUid = "";
const catalog = [
  "/profile", "/tasks", "/projects", "/habits", "/notes",
  "/finance/transactions", "/finance/categories", "/finance/budgets", "/finance/savings", "/finance/summary",
  "/goals", "/trackers", "/calendar/events", "/notifications", "/notifications/center",
  ...[1,7,30,35,90,365].map((days) => "/insights/overview?days=" + days),
  "/habits/insights?days=42", "/habits/streaks/overview",
];
const resourcePaths = [
  "/calendar/events", "/finance/transactions", "/finance/categories",
  "/finance/budgets", "/finance/savings", "/tasks", "/projects",
  "/habits", "/notes", "/goals", "/trackers", "/notifications",
];
function assertCurrentAccount(uid: string): void {
  if (initializedUid !== uid || firebaseAuth?.currentUser?.uid !== uid) {
    throw new Error("The mobile workspace account changed.");
  }
}

function forAccount<TArgs extends unknown[], TResult>(
  uid: string, action: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args) => {
    assertCurrentAccount(uid);
    const result = await action(...args);
    assertCurrentAccount(uid);
    return result;
  };
}

function transportFailed(error: unknown): boolean {
  return error instanceof Error && error.name === "ApiRequestError"
    && "status" in error && error.status === 0;
}

const timestamp = () => new Date().toISOString();
const obj = (v: unknown): v is JsonRecord => typeof v === "object" && v !== null && !Array.isArray(v);
const data = (v: string | null | undefined): JsonRecord => {
  if (!v) return {};
  try { const result: unknown = JSON.parse(v); return obj(result) ? result : {}; } catch { return {}; }
};
const recordId = (v: unknown): string => obj(v) && typeof v.id === "string" ? v.id : "";
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function section(path: string): { list: string; id: string | null; rest: string } | null {
  for (const list of resourcePaths) {
    if (path === list) return { list, id: null, rest: "" };
    if (path.startsWith(list + "/")) {
      const suffix = path.slice(list.length + 1);
      const [id, ...parts] = suffix.split("/");
      return { list, id, rest: parts.join("/") };
    }
  }
  return null;
}

async function patchCache(uid: string, path: string, method: string, payload: JsonRecord, serverItem?: JsonRecord): Promise<unknown> {
  const save = forAccount(uid, saveResponse);
  const read = <T>(path: string) => forAccount(uid, cachedResponse<T>)(path);
  const listItems = async (path: string): Promise<JsonRecord[]> => {
    const value = await read<{ items?: JsonRecord[] }>(path);
    return Array.isArray(value?.items) ? value.items : [];
  };
  const parsed = section(path);
  if (!parsed) {
    if (method === "PUT" || method === "PATCH") {
      const current = await read<{ item?: JsonRecord }>(path);
      const response = { item: { ...current?.item, ...payload } };
      await save(path, response);
      return response;
    }
    return { item: payload };
  }
  const { list, id, rest } = parsed;
  if (rest) {
    // Nested resources require a local source of truth, not an untracked remote call.
    if (rest === "blocks" && method === "PUT") {
      const page = (await listItems(list)).find((item) => item.id === id);
      const saved = { item: { ...page, title: payload.title ?? page?.title ?? "Untitled", updated_at: timestamp() }, blocks: payload.blocks ?? [] };
      await save(list + "/" + id, saved);
      const items = (await listItems(list)).map((item) => item.id === id ? { ...item, title: saved.item.title, updated_at: timestamp() } : item);
      await save(list, { items });
      return saved;
    }
    if (rest === "subtasks" && method === "POST") {
      const child = { id: crypto.randomUUID(), parent_task_id: id, status: "not_started", priority: "normal", ...payload, ...serverItem, created_at: timestamp(), updated_at: timestamp() };
      await save(list, { items: [...await listItems(list), child] });
      await save(path, { items: [...await listItems(path), child] });
      return { item: child };
    }
    if (rest === "increment" && method === "POST") {
      const items = await listItems(list);
      const current = items.find((item) => item.id === id);
      const changed = { ...current, current_value: Number(current?.current_value ?? 0) + 1 };
      await save(list, { items: items.map((item) => item.id === id ? changed : item) });
      return { item: changed };
    }
    if (rest === "notes" && method === "PUT") {
      const saved = { items: payload.blocks ?? [], updated_at: timestamp() };
      await save(path, saved);
      return saved;
    }
    if (rest === "dependencies" && method === "PUT") {
      const saved = { items: payload.depends_on ?? [] };
      await save(path, saved);
      return saved;
    }
    if (rest.startsWith("entries")) {
      const entriesPath = list + "/" + id + "/entries";
      const entries = await listItems(entriesPath);
      const entryDate = rest.startsWith("entries/") ? rest.substring(8) : null;
      const row = { ...payload, ...(entryDate ? { entry_date: entryDate } : { id: crypto.randomUUID(), recorded_at: timestamp() }), ...serverItem };
      const key = entryDate ? "entry_date" : "id";
      const updated = method === "DELETE"
        ? entries.filter((item) => item[key] !== entryDate)
        : [...entries.filter((item) => item[key] !== row[key]), row];
      await save(entriesPath, { items: updated });
      return { item: row };
    }
    return { item: serverItem ?? payload };
  }
  if (list === "/notifications" && method === "POST") return { item: payload };
  const previous = await listItems(list);
  if (method === "DELETE") {
    if (id) {
      const remove = forAccount(uid, removeResponse);
      for (const detail of detailPaths(list, id)) await remove(detail);
    }
    await save(list, { items: previous.filter((item) => item.id !== id) });
    return undefined;
  }
  if (id) {
    const original = previous.find((item) => item.id === id) ?? {};
    const changes = { ...payload };
    if (list === "/calendar/events" && typeof changes.completed === "boolean") {
      changes.completed_at = changes.completed ? timestamp() : null;
    }
    if (list === "/tasks" && changes.status === "completed" && !original.completed_at) {
      changes.completed_at = timestamp();
    }
    if (list === "/tasks" && changes.status && changes.status !== "completed") {
      changes.completed_at = null;
    }
    const row = { ...original, ...changes, ...serverItem, id, updated_at: timestamp() };
    await save(list, { items: previous.some((item) => item.id === id)
      ? previous.map((item) => item.id === id ? row : item)
      : [...previous, row] });
    return { item: row };
  }
  const created = { id: crypto.randomUUID(), created_at: timestamp(), updated_at: timestamp(), ...payload, ...serverItem };
  await save(list, { items: [...previous, created] });
  return { item: created };
}
function endpointFor(path: string, method: string): boolean {
  if (!section(path) && path !== "/profile") return false;
  if (path === "/profile") return method === "PUT";
  if (path.startsWith("/notifications")) return false;
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}
export async function openMobileWorkspace(): Promise<boolean> {
  if (!isNativeMobile) return false;
  const uid = firebaseAuth?.currentUser?.uid;
  if (!uid) return false;
  if (initializedUid !== uid) {
    if (initializedUid) resetMobileWorkspace();
    await activateMobileAccount(uid);
    if (firebaseAuth?.currentUser?.uid !== uid) throw new Error("The mobile workspace account changed.");
    initializedUid = uid;
  }
  return true;
}
export function resetMobileWorkspace(): void {
  initializedUid = "";
  lastSync = 0;
  transporting = null;
  syncing = null;
}
export async function mobileRequest<T>(
  path: string, init: RequestInit, transport: RequestTransport,
): Promise<T> {
  const uid = firebaseAuth?.currentUser?.uid;
  if (!uid || !await openMobileWorkspace()) return transport(path, init) as Promise<T>;
  assertCurrentAccount(uid);
  const send = forAccount(uid, transport);
  const save = forAccount(uid, saveResponse);
  transporting = send;
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET") {
    let fetchFailure: unknown = null;
    const pending = await forAccount(uid, pendingMutations)();
    const affected = pending.some((item) => {
      const group = section(item.path);
      return path === item.path || (group && path === group.list) ||
        item.path.startsWith(path + "/") || path.startsWith(item.path + "/");
    });
    if (!affected) {
      try {
        const remote = await send(path, init) as T;
        await save(path, remote);
        window.dispatchEvent(new CustomEvent("dayloop:cache-state", { detail: { stale: false } }));
        if (pending.length && !syncing && Date.now() - lastSync > 60_000) void syncMobileChanges().catch(() => {});
        return remote;
      } catch (error) {
        assertCurrentAccount(uid);
        if (init.signal?.aborted || !transportFailed(error)) throw error;
        fetchFailure = error;
      }
    }
    const derived = await forAccount(uid, deriveOffline)(path);
    if (derived !== null) {
      window.dispatchEvent(new CustomEvent("dayloop:cache-state", { detail: { stale: true } }));
      return derived as T;
    }
    const cached = await forAccount(uid, cachedResponse<T>)(path);
    if (cached !== null) {
      window.dispatchEvent(new CustomEvent("dayloop:cache-state", { detail: { stale: true } }));
      return cached;
    }
    // A first download must not mask a real network/API configuration error.
    if (fetchFailure instanceof Error) {
      throw new Error(`Unable to load ${path}: ${fetchFailure.message}`);
    }
    throw new Error(`The ${path} section is not cached on this phone. Connect to your DayLoop backend and open this section once to download it.`);
  }
  if (!endpointFor(path, method)) {
    return send(path, init) as Promise<T>;
  }
  const body = typeof init.body === "string" ? init.body : null;
  const input = data(body);
  const remote = await send(path, init) as { item?: JsonRecord } | undefined;
  await patchCache(uid, path, method, input, remote?.item);
  return remote as T;
}
async function reconcileCreatedId(uid: string, operation: PendingMutation, serverId: string): Promise<boolean> {
  const tempId = data(operation.base).__temp_id;
  if (typeof tempId !== "string" || !tempId || !serverId || tempId === serverId) return false;
  const { replaceMobileTempId } = await import("./mobileIds");
  await forAccount(uid, replaceMobileTempId)(tempId, serverId, operation.op_id);
  return true;
}
function changedAgainstBase(base: JsonRecord, remote: JsonRecord, intended: JsonRecord, method: string): boolean {
  if (method === "DELETE") return !same(base, remote);
  const normalized = (record: JsonRecord): JsonRecord => {
    if ("item" in record && "blocks" in record && obj(record.item)) {
      return { ...record.item, blocks: record.blocks };
    }
    if ("items" in record && !("id" in record)) return { blocks: record.items };
    return record;
  };
  const earlier = normalized(base), current = normalized(remote);
  return Object.keys(intended).some((key) => !same(earlier[key], current[key]) && !same(intended[key], current[key]));
}
async function serverItemFor(operation: PendingMutation, send: RequestTransport): Promise<JsonRecord | null> {
  const parsed = section(operation.path);
  if (!parsed?.id) return null;
  // GET collection routes are available for all principal DayLoop entities.
  if (parsed.rest === "blocks" || parsed.rest === "notes") {
    return await send(parsed.list + "/" + parsed.id + (parsed.rest === "notes" ? "/notes" : "")) as JsonRecord;
  }
  const collection = await send(parsed.list) as { items?: JsonRecord[] };
  return collection.items?.find((item) => item.id === parsed.id) ?? null;
}
const feedRoutes: Record<string,string> = {
  users: "/profile", projects: "/projects", tasks: "/tasks", task_dependencies: "/tasks",
  note_pages: "/notes", note_blocks: "/notes", habits: "/habits",
  habit_entries: "/habits", habit_schedules: "/habits",
  finance_categories: "/finance/categories", finance_transactions: "/finance/transactions",
  budgets: "/finance/budgets", budget_category_limits: "/finance/budgets",
  savings_goals: "/finance/savings", savings_contributions: "/finance/savings",
  goals: "/goals", goal_milestones: "/goals",
  tracker_definitions: "/trackers", tracker_entries: "/trackers",
  calendar_events: "/calendar/events", notifications: "/notifications",
  notification_jobs: "/notifications", notification_deliveries: "/notifications",
  streak_events: "/habits", task_notes: "/tasks", attachments: "/attachments",
};
function detailPaths(route: string, id: string): string[] {
  if (route === "/notes") return [route + "/" + id];
  if (route === "/tasks") return [route + "/" + id + "/notes", route + "/" + id + "/subtasks"];
  if (route === "/habits" || route === "/trackers") return [route + "/" + id + "/entries"];
  return [];
}

function cachedIds(value: unknown): string[] {
  if (!obj(value) || !Array.isArray(value.items)) return [];
  return value.items.map(recordId).filter(Boolean);
}

async function pullServerChanges(uid: string, send: RequestTransport): Promise<boolean> {
  const save = forAccount(uid, saveResponse);
  const read = forAccount(uid, cachedResponse);
  const remove = forAccount(uid, removeResponse);
  let changed = false;
  // Never discard unsynced or unresolved local edits with a server snapshot.
  if ((await forAccount(uid, pendingMutations)()).length || (await forAccount(uid, listConflicts)()).length) return false;
  const getValue = forAccount(uid, getSyncValue);
  const setValue = forAccount(uid, setSyncValue);
  let cursor = Number(await getValue("server_cursor") ?? "0");
  const savedTransactionCursor = await getValue("server_cursor_v2");
  let [transaction, sequence] = /^\d+:\d+$/.test(savedTransactionCursor ?? "")
    ? savedTransactionCursor!.split(":") : ["0", "0"];
  for (let page = 0; page < 100; page++) {
    const query = new URLSearchParams({
      after: String(cursor), limit: "200", after_tx: transaction, after_sequence: sequence,
    });
    const response = await send("/sync/changes?" + query) as {
      items: Array<{entity:string}>;
      next_cursor?: number;
      next_transaction?: string;
      next_sequence?: string;
      has_more: boolean;
    };
    const routes = new Set((response.items ?? []).map((event) => feedRoutes[event.entity]).filter(Boolean));
    for (const route of routes) {
      const previous = new Set(cachedIds(await read(route)));
      const fresh = await send(route);
      for (const id of cachedIds(fresh)) {
        previous.delete(id);
        for (const detail of detailPaths(route, id)) {
          if (route === "/notes" || await read(detail) !== null) await save(detail, await send(detail));
        }
      }
      for (const id of previous) {
        for (const detail of detailPaths(route, id)) await remove(detail);
      }
      await save(route, fresh);
    }
    if (response.next_transaction !== undefined && response.next_sequence !== undefined) {
      transaction = response.next_transaction;
      sequence = response.next_sequence;
      await setValue("server_cursor_v2", transaction + ":" + sequence);
    } else if (response.next_cursor !== undefined) {
      cursor = response.next_cursor;
      await setValue("server_cursor", String(cursor));
    }
    changed ||= routes.size > 0;
    if (!response.has_more) break;
  }
  return changed;
}
export async function syncMobileChanges(): Promise<void> {
  const uid = firebaseAuth?.currentUser?.uid;
  if (!uid || !navigator.onLine || !await openMobileWorkspace() || !transporting) return;
  assertCurrentAccount(uid);
  if (syncing) return syncing;
  const send = transporting;
  const flight = (async () => {
    let changed = false;
    const readQueue = forAccount(uid, pendingMutations);
    let queue = await readQueue();
    while (queue.length) {
      const op = queue.shift()!;
      const conflicts = await forAccount(uid, listConflicts)();
      if (conflicts.some((item) => item.op_id === op.op_id)) break;
      try {
        const input = data(op.body);
        const base = op.base ? data(op.base) : null;
        if (base && !base.__temp_id && section(op.path)?.id) {
          const remote = await serverItemFor(op, send);
          if (remote === null && op.method === "DELETE") {
            await forAccount(uid, removeMutation)(op.op_id); // Already removed on the server.
            changed = true;
            continue;
          }
          if (remote === null || changedAgainstBase(base, remote, input, op.method)) {
            await forAccount(uid, saveConflict)({ op_id: op.op_id, path: op.path, base: op.base, local: op.body, remote: remote ? JSON.stringify(remote) : null });
            break;
          }
        }
        const result = await send(op.path, { method: op.method, ...(op.body ? { body: op.body } : {}) }) as { item?: JsonRecord } | undefined;
        if (op.method === "POST" && await reconcileCreatedId(uid, op, recordId(result?.item))) {
          queue = await readQueue();
        } else {
          await forAccount(uid, removeMutation)(op.op_id);
        }
        changed = true;
      } catch {
        // Preserve queue and retry on next foreground/reconnection.
        break;
      }
    }
    try { changed = await pullServerChanges(uid, send) || changed; } catch { /* Retry remote pull when the API is available. */ }
    assertCurrentAccount(uid);
    lastSync = Date.now();
    if (changed) window.dispatchEvent(new Event("dayloop:mobile-sync"));
  })();
  syncing = flight;
  try { await flight; } finally { if (syncing === flight) syncing = null; }
}
export function scheduleMobileSync(): () => void {
  if (!isNativeMobile) return () => {};
  const run = () => { if (!syncing && Date.now() - lastSync > 5000) void syncMobileChanges().catch(() => {}); };
  window.addEventListener("online", run);
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", run);
  run();
  return () => {
    window.removeEventListener("online", run);
    window.removeEventListener("focus", run);
    document.removeEventListener("visibilitychange", run);
  };
}
export async function preloadMobileWorkspace(): Promise<void> {
  const uid = firebaseAuth?.currentUser?.uid;
  if (!uid || !await openMobileWorkspace() || !transporting) return;
  assertCurrentAccount(uid);
  const send = transporting;
  const save = forAccount(uid, saveResponse);
  const setValue = forAccount(uid, setSyncValue);
  // Bootstrap existing PostgreSQL records through authenticated FastAPI.
  // Never overwrite a section with queued offline changes.
  let downloaded = 0;
  const missing: string[] = [];
  for (const path of catalog) {
    const pending = await forAccount(uid, pendingMutations)();
    const locallyEdited = pending.some((op) =>
      op.path === path || op.path.startsWith(path + "/") || path.startsWith(op.path + "/"));
    if (locallyEdited) continue;
    try {
      const result = await send(path);
      await save(path, result);
      downloaded++;
      for (const id of cachedIds(result)) {
        for (const detail of detailPaths(path, id)) {
          try { await save(detail, await send(detail)); }
          catch { missing.push(detail); }
        }
      }
    } catch { missing.push(path); }
  }
  await setValue("bootstrap_status", missing.length ? "incomplete" : "complete");
  await setValue("bootstrap_downloaded", String(downloaded));
  await setValue("bootstrap_missing", JSON.stringify(missing));
  await setValue("bootstrap_last_attempt", new Date().toISOString());
  window.dispatchEvent(new Event("dayloop:mobile-sync"));
}
