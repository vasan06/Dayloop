import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Smartphone } from "lucide-react";
import { isNativeMobile, listConflicts, pendingMutations, resolveConflict, type SyncConflict } from "../lib/mobileData";
import { syncMobileChanges } from "../lib/mobileApi";

export default function MobileSyncPanel() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    try {
      const [items, changes] = await Promise.all([listConflicts(), pendingMutations()]);
      setConflicts(items); setPending(changes.length);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read local sync status"); }
  }, []);
  useEffect(() => {
    if (!isNativeMobile) return;
    void refresh();
    window.addEventListener("dayloop:mobile-data", refresh);
    window.addEventListener("dayloop:mobile-sync", refresh);
    return () => {
      window.removeEventListener("dayloop:mobile-data", refresh);
      window.removeEventListener("dayloop:mobile-sync", refresh);
    };
  }, [refresh]);
  if (!isNativeMobile) return null;
  async function sync() {
    setBusy(true); setError("");
    try { await syncMobileChanges(); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Sync failed"); }
    finally { setBusy(false); }
  }
  async function decide(id: string, keep: "local" | "remote" | "merged") {
    setBusy(true); setError("");
    try {
      if (keep === "merged") {
        const text = editing[id] ?? "";
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Merged changes must be a JSON object.");
        await resolveConflict(id, "merged", text);
      } else await resolveConflict(id, keep);
      await refresh();
      if (keep !== "remote") await syncMobileChanges();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Conflict could not be resolved"); }
    finally { setBusy(false); }
  }
  return <section className="card" aria-label="Mobile synchronization" style={{ padding: 20, gridColumn: "1 / -1" }}>
    <div className="row sb" style={{ gap: 12, alignItems: "center" }}>
      <div><h3 style={{ margin: 0 }}><Smartphone className="ic" /> Mobile synchronization</h3>
        <p className="mute sm">Your changes are saved on this device and sent when the DayLoop API is reachable.</p></div>
      <button className="btn sm" onClick={() => void sync()} disabled={busy}><RefreshCw className="ic" />{busy ? "Syncing..." : "Sync now"}</button>
    </div>
    <div className="row" style={{ gap: 18 }}>
      <span><CheckCircle2 className="ic" /> {pending} pending change{pending === 1 ? "" : "s"}</span>
      <span><AlertTriangle className="ic" /> {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}</span>
    </div>
    {error && <p className="err" role="alert">{error}</p>}
    {conflicts.map((conflict) => <div className="card" key={conflict.op_id} style={{ padding: 14, marginTop: 12 }}>
      <b>Conflict: {conflict.path}</b>
      <p className="mute sm">Both devices edited this record. Choose which change to preserve.</p>
      <div className="g" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        <div><b>Mobile changes</b><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{conflict.local ?? "(deleted)"}</pre></div>
        <div><b>PC version</b><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{conflict.remote ?? "(deleted)"}</pre></div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm" disabled={busy} onClick={() => void decide(conflict.op_id, "remote")}>Keep PC</button>
        <button className="btn sm" disabled={busy} onClick={() => void decide(conflict.op_id, "local")}>Keep Mobile</button>
      </div>
      <label className="field"><span>Or merge fields (JSON object)</span>
        <textarea rows={3} aria-label="Manually merged changes" value={editing[conflict.op_id] ?? conflict.local ?? "{}"} onChange={(e) => setEditing((prev) => ({ ...prev, [conflict.op_id]: e.target.value }))}/>
      </label>
      <button className="btn sm" disabled={busy} onClick={() => void decide(conflict.op_id, "merged")}>Apply merged fields</button>
    </div>)}
  </section>;
}
