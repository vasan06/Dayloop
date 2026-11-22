import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import type { Notification } from "../lib/types";

export default function NotificationAction() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get("id");
  const [item, setItem] = useState<Notification | null>(null);
  const [action, setAction] = useState(params.get("action") || "complete");
  const [note, setNote] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    let active = true;
    void apiRequest<{ items: Notification[] }>("/notifications")
      .then(({ items }) => { if (active) setItem(items.find((entry) => entry.id === id) ?? null); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load notification."); });
    return () => { active = false; };
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!id || !item || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/notifications/${id}/action`, {
        method: "POST",
        body: JSON.stringify({ action, note, ...(value.trim() ? { value: Number(value) } : {}) }),
      });
      navigate(item.click_path || "/", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="card" style={{ maxWidth: 440, margin: "10vh auto", padding: 24 }}>
    <h1>Quick action</h1>
    {item ? <><h2>{item.title}</h2><p>{item.body}</p></> : <p>Loading notification…</p>}
    {error && <p role="alert">{error}</p>}
    <form onSubmit={(event) => void submit(event)}>
      <label>Action <select value={action} onChange={(event) => setAction(event.target.value)}>
        <option value="complete">Complete</option>
        {item?.source_type === "habit" && <option value="skip">Skip</option>}
        <option value="snooze">Snooze 15 minutes</option>
      </select></label>
      {item?.source_type === "habit" && action === "complete" && <label>Value, if needed <input type="number" value={value} onChange={(event) => setValue(event.target.value)} /></label>}
      {item?.source_type === "habit" && action !== "snooze" && <label>Note or response <input value={note} onChange={(event) => setNote(event.target.value)} /></label>}
      <div className="row" style={{ marginTop: 16, gap: 8 }}><button className="btn pri" disabled={!item || busy}>{busy ? "Saving…" : "Save action"}</button><button className="btn" type="button" onClick={() => navigate(-1)}>Cancel</button></div>
    </form>
  </main>;
}
