import { useCallback, useEffect, useState } from "react";
import { isNativeMobile, listConflicts, pendingMutations, resolveConflict, type SyncConflict } from "../lib/mobileData";
import { syncMobileChanges } from "../lib/mobileApi";
import { toast } from "../lib/toast";

export default function OfflineRecovery() {
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const [changes, blocked] = await Promise.all([pendingMutations(), listConflicts()]);
      setPending(changes.length);
      setConflicts(blocked);
    } catch (error) { toast(error instanceof Error ? error.message : "Could not read offline edits.", "error"); }
  }, []);
  useEffect(() => {
    if (!isNativeMobile) return;
    void refresh();
    window.addEventListener("dayloop:mobile-data", refresh);
    window.addEventListener("dayloop:mobile-sync", refresh);
    return () => { window.removeEventListener("dayloop:mobile-data", refresh); window.removeEventListener("dayloop:mobile-sync", refresh); };
  }, [refresh]);
  if (!isNativeMobile || (pending === 0 && conflicts.length === 0)) return null;

  async function exportEdits() {
    const [changes, blocked] = await Promise.all([pendingMutations(), listConflicts()]);
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exported_at: new Date().toISOString(), changes, conflicts: blocked }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `dayloop-offline-edits-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function decide(id: string, choice: "local" | "remote") {
    setBusy(true);
    try {
      await resolveConflict(id, choice);
      if (choice === "local") await syncMobileChanges();
      await refresh();
      toast("Offline edit resolved.");
    } catch (error) { toast(error instanceof Error ? error.message : "Could not resolve offline edit.", "error"); }
    finally { setBusy(false); }
  }
  return <section className="card" aria-label="Offline edit recovery" style={{ padding: 20, gridColumn: "1 / -1" }}>
    <h3>Offline edits need attention</h3>
    <p className="mute sm">{pending} edit{pending === 1 ? "" : "s"} waiting to sync. Your device keeps them until they are sent or resolved.</p>
    <button className="btn sm" type="button" onClick={() => void exportEdits().catch((error) => toast(error instanceof Error ? error.message : "Could not export edits.", "error"))}>Save a copy of offline edits</button>
    {conflicts.map((conflict) => <div key={conflict.op_id} className="settings-section">
      <b>Conflict in {conflict.path}</b>
      <p className="mute sm">Both this device and the server changed this record. Save a copy before choosing which version to keep.</p>
      <div className="row wrap" style={{ gap: 8 }}>
        <button className="btn sm" disabled={busy} onClick={() => void decide(conflict.op_id, "local")}>Keep this device</button>
        <button className="btn sm" disabled={busy} onClick={() => void decide(conflict.op_id, "remote")}>Keep server version</button>
      </div>
    </div>)}
  </section>;
}
