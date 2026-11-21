// Re-map a client-generated ID to the real server ID throughout durable local storage.
// Only exact scalar string matches are replaced; freeform note text is never touched.
export async function replaceMobileTempId(from: string, to: string): Promise<void> {
  const { activeMobileDatabase } = await import("./mobileData");
  const db = activeMobileDatabase();
  const replace = (value: unknown): unknown => {
    if (typeof value === "string") return value === from ? to : value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    }
    return value;
  };
  const cache = (await db.query("SELECT path,payload FROM response_cache")).values ?? [];
  const outbox = (await db.query("SELECT op_id,path,body,base FROM pending_mutations")).values ?? [];
  for (const entry of cache) {
    const path = String(entry.path);
    const nextPath = path.split("/").map((segment) => segment === from ? to : segment).join("/");
    const payload = JSON.stringify(replace(JSON.parse(String(entry.payload))));
    await db.run("DELETE FROM response_cache WHERE path=?", [path]);
    await db.run(
      "INSERT OR REPLACE INTO response_cache(path,payload,fetched_at) VALUES(?,?,?)",
      [nextPath, payload, new Date().toISOString()],
    );
  }
  for (const entry of outbox) {
    const path = String(entry.path).split("/").map((segment) => segment === from ? to : segment).join("/");
    const body = entry.body == null ? null : JSON.stringify(replace(JSON.parse(String(entry.body))));
    const base = entry.base == null ? null : JSON.stringify(replace(JSON.parse(String(entry.base))));
    await db.run("UPDATE pending_mutations SET path=?,body=?,base=? WHERE op_id=?", [path,body,base,String(entry.op_id)]);
  }
}
