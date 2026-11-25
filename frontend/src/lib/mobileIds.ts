import type { capSQLiteSet } from "@capacitor-community/sqlite";
import { activeMobileDatabase } from "./mobileData";

// Match whole ID strings and path segments, leaving text containing an ID intact.
export async function replaceMobileTempId(from: string, to: string, completedOpId: string): Promise<void> {
  const db = activeMobileDatabase();
  const replace = (value: unknown): unknown => {
    if (typeof value === "string") return value === from ? to : value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    }
    return value;
  };
  const replacePath = (path: string) => path.split("/").map((segment) => segment === from ? to : segment).join("/");
  const replaceJson = (value: string) => value.includes(from) ? JSON.stringify(replace(JSON.parse(value))) : value;
  const cache = (await db.query("SELECT path,payload,fetched_at FROM response_cache")).values ?? [];
  const outbox = (await db.query("SELECT op_id,path,body,base FROM pending_mutations")).values ?? [];
  const writes: capSQLiteSet[] = [];
  for (const entry of cache) {
    const path = String(entry.path);
    const nextPath = replacePath(path);
    const original = String(entry.payload);
    const payload = replaceJson(original);
    if (nextPath !== path) {
      writes.push({ statement: "DELETE FROM response_cache WHERE path=?", values: [path] });
    }
    if (nextPath !== path || payload !== original) {
      writes.push({
        statement: "INSERT OR REPLACE INTO response_cache(path,payload,fetched_at) VALUES(?,?,?)",
        values: [nextPath, payload, entry.fetched_at],
      });
    }
  }
  for (const entry of outbox) {
    if (entry.op_id === completedOpId) continue;
    const path = replacePath(String(entry.path));
    const body = entry.body == null ? null : replaceJson(String(entry.body));
    const base = entry.base == null ? null : replaceJson(String(entry.base));
    if (path !== entry.path || body !== entry.body || base !== entry.base) {
      writes.push({
        statement: "UPDATE pending_mutations SET path=?,body=?,base=? WHERE op_id=?",
        values: [path, body, base, entry.op_id],
      });
    }
  }
  writes.push({ statement: "DELETE FROM pending_mutations WHERE op_id=?", values: [completedOpId] });
  if (db !== activeMobileDatabase()) throw new Error("The mobile workspace account changed.");
  await db.executeSet(writes, true);
  if (db === activeMobileDatabase()) window.dispatchEvent(new Event("dayloop:mobile-data"));
}
