import {
  activateMobileAccount, cachedResponse, getSyncValue, isNativeMobile, listConflicts, pendingMutations,
  queueMutation, removeMutation, saveConflict, saveResponse, setSyncValue, type PendingMutation,
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

async function listItems(path: string): Promise<JsonRecord[]> {
  const value = await cachedResponse<{ items?: JsonRecord[] }>(path);
  return Array.isArray(value?.items) ? value.items : [];
}
async function getObject(path: string, id: string): Promise<JsonRecord | null> {
  return (await listItems(path)).find((item) => item.id === id) ?? null;
}
async function patchCache(path: string, method: string, payload: JsonRecord, serverItem?: JsonRecord): Promise<unknown> {
  const parsed = section(path);
  if (!parsed) {
    if (method === "PUT" || method === "PATCH") {
      const current = await cachedResponse<{ item?: JsonRecord }>(path);
      const response = { item: { ...current?.item, ...payload } };
      await saveResponse(path, response);
      return response;
    }
    return { item: payload };
  }
  const { list, id, rest } = parsed;
  if (rest) {
    // Nested resources require a local source of truth, not an untracked remote call.
    if (rest === "blocks" && method === "PUT") {
      const page = await getObject(list, id!);
      const saved = { item: { ...page, title: payload.title ?? page?.title ?? "Untitled", updated_at: timestamp() }, blocks: payload.blocks ?? [] };
      await saveResponse(list + "/" + id, saved);
      const items = (await listItems(list)).map((item) => item.id === id ? { ...item, title: saved.item.title, updated_at: timestamp() } : item);
      await saveResponse(list, { items });
      return saved;
    }
    if (rest === "subtasks" && method === "POST") {
      const child = { id: crypto.randomUUID(), parent_task_id: id, status: "not_started", priority: "normal", ...payload, ...serverItem, created_at: timestamp(), updated_at: timestamp() };
      await saveResponse(list, { items: [...await listItems(list), child] });
      await saveResponse(path, { items: [...await listItems(path), child] });
      return { item: child };
    }
    if (rest === "increment" && method === "POST") {
      const items = await listItems(list);
      const current = items.find((item) => item.id === id);
      const changed = { ...current, current_value: Number(current?.current_value ?? 0) + 1 };
      await saveResponse(list, { items: items.map((item) => item.id === id ? changed : item) });
      return { item: changed };
    }
    if (rest === "notes" && method === "PUT") {
      const saved = { items: payload.blocks ?? [], updated_at: timestamp() };
      await saveResponse(path, saved);
      return saved;
    }
    if (rest === "dependencies" && method === "PUT") {
      const saved = { items: payload.depends_on ?? [] };
      await saveResponse(path, saved);
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
      await saveResponse(entriesPath, { items: updated });
      return { item: row };
    }
    return { item: serverItem ?? payload };
  }
  if (list === "/notifications" && method === "POST") return { item: payload };
  const previous = await listItems(list);
  if (method === "DELETE") {
    await saveResponse(list, { items: previous.filter((item) => item.id !== id) });
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
    await saveResponse(list, { items: previous.some((item) => item.id === id)
      ? previous.map((item) => item.id === id ? row : item)
      : [...previous, row] });
    return { item: row };
  }
  const created = { id: crypto.randomUUID(), created_at: timestamp(), updated_at: timestamp(), ...payload, ...serverItem };
  await saveResponse(list, { items: [...previous, created] });
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
    await activateMobileAccount(uid);
    initializedUid = uid;
    lastSync = 0;
  }
  return true;
}
export function resetMobileWorkspace(): void {
  initializedUid = "";
  lastSync = 0;
}
export async function mobileRequest<T>(
  path: string, init: RequestInit, send: RequestTransport,
): Promise<T> {
  if (!await openMobileWorkspace()) return send(path, init) as Promise<T>;
  transporting = send;
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET") {
    let fetchFailure: unknown = null;
    const pending = await pendingMutations();
    const affected = pending.some((item) => {
      const group = section(item.path);
      return path === item.path || (group && path === group.list) ||
        item.path.startsWith(path + "/") || path.startsWith(item.path + "/");
    });
    if (!affected) {
      try {
        const remote = await send(path, init) as T;
        await saveResponse(path, remote);
        if (!syncing) void syncMobileChanges().catch(() => {});
        return remote;
      } catch (error) {
        fetchFailure = error;
        // Preserve the underlying HTTP/network error if this section was never cached.
      }
    }
    const derived = await deriveOffline(path);
    if (derived !== null) return derived as T;
    const cached = await cachedResponse<T>(path);
    if (cached !== null) return cached;
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
  try {
    const remote = await send(path, init) as { item?: JsonRecord } | undefined;
    await patchCache(path, method, input, remote?.item);
    return remote as T;
  } catch (error) {
    // Offline intent is accepted only for transport failures, never 401/403/422/500.
    const networkFailure = error instanceof Error && /network error:|failed to fetch|network request failed/i.test(error.message);
    if (!networkFailure) throw error;
    const parsed = section(path);
    const detail = parsed?.rest === "blocks" || parsed?.rest === "notes"
      ? await cachedResponse(parsed?.rest === "blocks" ? parsed.list + "/" + parsed.id : path) : null;
    const base = obj(detail) ? detail : parsed?.id ? await getObject(parsed.list, parsed.id) : null;
    const parsedCreate = section(path);
    const temporaryId = method === "POST" && (!parsedCreate?.id || parsedCreate.rest === "subtasks" || parsedCreate.rest === "entries")
      ? crypto.randomUUID() : "";
    // Queue first: a crash cannot leave an unsynchronized local edit behind.
    await queueMutation({ path, method, body, base: temporaryId ? JSON.stringify({ __temp_id: temporaryId }) : base ? JSON.stringify(base) : null });
    const result = await patchCache(path, method, input, temporaryId ? { id: temporaryId } : undefined) as T;
    return result;
  }
}
async function rewriteTemporaryId(from: string, to: string): Promise<void> {
  if (!from || from === to) return;
  // Rewrite structured JSON cache and pending requests, never user text by guessing IDs.
  const { replaceMobileTempId } = await import("./mobileIds");
  await replaceMobileTempId(from, to);
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
async function pullServerChanges(send: RequestTransport): Promise<void> {
  // Never discard unsynced or unresolved local edits with a server snapshot.
  if ((await pendingMutations()).length || (await listConflicts()).length) return;
  let cursor = Number(await getSyncValue("server_cursor") ?? "0");
  for (let page = 0; page < 100; page++) {
    const response = await send("/sync/changes?after=" + cursor + "&limit=200") as {
      items: Array<{entity:string;sequence:number}>;
      next_cursor: number;
      has_more: boolean;
    };
    const routes = new Set((response.items ?? []).map((event) => feedRoutes[event.entity]).filter(Boolean));
    for (const route of routes) {
      const fresh = await send(route);
      await saveResponse(route, fresh);
      if (route === "/notes") {
        for (const item of (fresh as {items?:JsonRecord[]}).items ?? []) {
          const id = recordId(item);
          if (id) await saveResponse(route + "/" + id, await send(route + "/" + id));
        }
      }
    }
    cursor = response.next_cursor;
    await setSyncValue("server_cursor", String(cursor));
    if (!response.has_more) break;
  }
}
export async function syncMobileChanges(): Promise<void> {
  if (!await openMobileWorkspace() || !transporting || !navigator.onLine) return;
  if (syncing) return syncing;
  syncing = (async () => {
    const send = transporting!;
    for (const op of await pendingMutations()) {
      const conflicts = await listConflicts();
      if (conflicts.some((item) => item.op_id === op.op_id)) break;
      try {
        const input = data(op.body);
        const base = op.base ? data(op.base) : null;
        if (base && !base.__temp_id && section(op.path)?.id) {
          const remote = await serverItemFor(op, send);
          if (remote === null && op.method === "DELETE") {
            await removeMutation(op.op_id); // Already removed on the server.
            continue;
          }
          if (remote === null || changedAgainstBase(base, remote, input, op.method)) {
            await saveConflict({ op_id: op.op_id, path: op.path, base: op.base, local: op.body, remote: remote ? JSON.stringify(remote) : null });
            break;
          }
        }
        const result = await send(op.path, { method: op.method, ...(op.body ? { body: op.body } : {}) }) as { item?: JsonRecord } | undefined;
        if (op.method === "POST" && result?.item?.id) {
          const collection = section(op.path);
          if (collection) {
            const tempId = op.base ? data(op.base).__temp_id : null;
            if (typeof tempId === "string") await rewriteTemporaryId(tempId, recordId(result.item));
          }
        }
        await removeMutation(op.op_id);
      } catch {
        // Preserve queue and retry on next foreground/reconnection.
        break;
      }
    }
    try { await pullServerChanges(send); } catch { /* Retry remote pull when the API is available. */ }
    lastSync = Date.now();
    window.dispatchEvent(new Event("dayloop:mobile-sync"));
  })();
  try { await syncing; } finally { syncing = null; }
}
export function scheduleMobileSync(): () => void {
  if (!isNativeMobile) return () => {};
  const run = () => { if (!syncing && Date.now() - lastSync > 5000) void syncMobileChanges(); };
  window.addEventListener("online", run);
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", run);
  const timer = window.setInterval(run, 30000);
  run();
  return () => {
    window.removeEventListener("online", run);
    window.removeEventListener("focus", run);
    document.removeEventListener("visibilitychange", run);
    window.clearInterval(timer);
  };
}
export async function preloadMobileWorkspace(): Promise<void> {
  if (!await openMobileWorkspace() || !transporting) return;
  if ((await pendingMutations()).length) return;
  for (const path of catalog) {
    try {
      const result = await transporting(path);
      await saveResponse(path, result);
      if (path === "/notes" || path === "/trackers" || path === "/habits" || path === "/tasks") {
        const collection = result as { items?: JsonRecord[] };
        for (const item of collection.items ?? []) {
          const id = recordId(item);
          if (!id) continue;
          const detail = path === "/notes" ? path + "/" + id :
            path === "/tasks" ? path + "/" + id + "/notes" : path + "/" + id + "/entries";
          try { await saveResponse(detail, await transporting(detail)); } catch { /* optional detail */ }
        }
      }
    } catch { /* optional section */ }
  }
}
