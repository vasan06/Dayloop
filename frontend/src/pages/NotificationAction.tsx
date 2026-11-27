import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { scheduleHabitSnooze } from "../lib/notifications";
import type { Habit, Notification } from "../lib/types";

type Target = { id: string; title: string; body?: string; due_at?: string; start_at?: string; end_at?: string };
type Action = "complete" | "skip" | "snooze" | "reschedule" | "clear";
const toLocal = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function NotificationAction() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const id = params.get("id");
  const sourceId = params.get("sourceId");
  const requestedType = params.get("type");
  const [item, setItem] = useState<Notification | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [habit, setHabit] = useState<Habit | null>(null);
  const [kind, setKind] = useState(requestedType || "");
  const requestedAction = params.get("action");
  const validActions: Action[] = ["complete", "skip", "snooze", "reschedule", "clear"];
  const [action, setAction] = useState<Action>(validActions.includes(requestedAction as Action)
    ? requestedAction as Action : "complete");
  const [note, setNote] = useState("");
  const [value, setValue] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [date, setDate] = useState(toLocal(new Date(Date.now() + 15 * 60000)));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(id || sourceId));
  const [error, setError] = useState("");
  const goBack = () => Number(window.history.state?.idx ?? 0) > 0
    ? navigate(-1) : navigate(kind === "task" ? "/tasks" : kind === "event" ? "/calendar" : kind === "habit" ? "/habits" : "/", { replace: true });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let notification: Notification | undefined;
        if (id || (requestedType === "habit" && sourceId)) {
          const response = await apiRequest<{ items: Notification[] }>("/notifications");
          notification = response.items.find((entry) => id ? entry.id === id : entry.source_type === "habit" && entry.source_id === sourceId);
          if (active) { setItem(notification ?? null); if (notification && !requestedType) setKind(notification.source_type || ""); }
        }
        const type = requestedType || notification?.source_type;
        const record = sourceId || notification?.source_id;
        if ((type === "task" || type === "event") && record) {
          const path = type === "task" ? "/tasks" : "/calendar/events";
          const response = await apiRequest<{ items: Target[] }>(path);
          if (active) {
            const match = response.items.find((entry) => entry.id === record) ?? null;
            setTarget(match);
            if (match?.due_at || match?.start_at) setDate(toLocal(new Date(match.due_at || match.start_at!)));
          }
        }
        if (type === "habit" && record) {
          const response = await apiRequest<{ items: Habit[] }>("/habits");
          if (active) setHabit(response.items.find((entry) => entry.id === record) ?? null);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load the notification.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [id, sourceId, requestedType]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const record = sourceId || item?.source_id;
      const currentNotificationId = id || item?.id;
      const targetPage = kind === "task" ? "/tasks" : kind === "event" ? "/calendar" : kind === "habit" ? "/habits" : "/";
      if (action === "clear") {
        if (currentNotificationId) await apiRequest(`/notifications/${currentNotificationId}/dismiss`, { method: "PATCH" });
      } else if (action === "reschedule" && record && (kind === "task" || kind === "event")) {
        const when = new Date(date);
        if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) throw new Error("Choose a future date and time.");
        if (kind === "task") {
          await apiRequest(`/tasks/${record}`, { method: "PATCH", body: JSON.stringify({ due_at: when.toISOString() }) });
        } else {
          const originalStart = target?.start_at ? Date.parse(target.start_at) : Date.now();
          const originalEnd = target?.end_at ? Date.parse(target.end_at) : originalStart;
          const duration = Math.max(0, originalEnd - originalStart);
          await apiRequest(`/calendar/events/${record}`, { method: "PATCH", body: JSON.stringify({
            start_at: when.toISOString(), end_at: new Date(when.getTime() + duration).toISOString(),
          }) });
        }
        if (currentNotificationId) await apiRequest(`/notifications/${currentNotificationId}/dismiss`, { method: "PATCH" });
      } else if (kind === "task" && record && action === "complete") {
        await apiRequest(`/tasks/${record}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
        if (currentNotificationId) await apiRequest(`/notifications/${currentNotificationId}/dismiss`, { method: "PATCH" });
      } else if (kind === "event" && record && action === "complete") {
        await apiRequest(`/calendar/events/${record}`, { method: "PATCH", body: JSON.stringify({ completed: true }) });
        if (currentNotificationId) await apiRequest(`/notifications/${currentNotificationId}/dismiss`, { method: "PATCH" });
      } else if (kind === "habit" && record && !id && !item?.id && (action === "complete" || action === "skip")) {
        // Android can fire a scheduled habit reminder while the backend job
        // is still pending. Save directly to the user's habit in that case.
        if (!habit) throw new Error("This habit could not be loaded. Reopen the reminder and try again.");
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: habit.timezone,
          year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
        const part = (name: string) => parts.find((entry) => entry.type === name)?.value ?? "";
        const localDay = `${part("year")}-${part("month")}-${part("day")}`;
        await apiRequest(`/habits/${record}/entries/${localDay}`, {
          method: "PUT",
          body: JSON.stringify({ status: action === "complete" ? "completed" : "skipped", note,
            ...(value.trim() ? { value: Number(value) } : {}) }),
        });
      } else if (kind === "habit" && record && !id && !item?.id && action === "snooze") {
        await scheduleHabitSnooze(record, Date.now() + minutes * 60000);
      } else if ((id || item?.id) && ["complete", "skip", "snooze"].includes(action)) {
        await apiRequest(`/notifications/${id || item?.id}/action`, {
          method: "POST",
          body: JSON.stringify({ action, note, minutes, ...(value.trim() ? { value: Number(value) } : {}) }),
        });
      } else {
        throw new Error("This alert does not have a supported action. Choose Clear.");
      }
      await queryClient.invalidateQueries();
      navigate(targetPage, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the action.");
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = kind === "task" ? "Task" : kind === "event" ? "Calendar event" : kind === "habit" ? "Habit" : "Notification";
  return <main className="reminder-page">
    <section className="reminder-card">
    <button className="reminder-back" type="button" onClick={goBack}>← Back</button>
    <div className="reminder-eyebrow">{kindLabel} reminder</div>
    <h1>{target?.title || habit?.name || item?.title || (loading ? "Loading notification…" : "Notification")}</h1>
    {(target?.body || item?.body) && <p className="reminder-body">{target?.body || item?.body}</p>}
    {error && <p role="alert" className="err">{error}</p>}
    <form onSubmit={(event) => void submit(event)}>
      <fieldset className="reminder-choices"><legend>What would you like to do?</legend>
        {([
          ...(kind === "task" || kind === "event" || kind === "habit" ? [{ id: "complete", label: kind === "habit" ? "Record completed" : "Mark done" }] : []),
          ...(kind === "habit" ? [{ id: "skip", label: "Skip habit" }] : []),
          ...(kind === "task" || kind === "event" ? [{ id: "reschedule", label: "Reschedule" }] : []),
          ...(kind === "habit" ? [{ id: "snooze", label: "Remind me later" }] : []),
          { id: "clear", label: "Clear alert" },
        ] as Array<{ id: Action; label: string }>).map((choice) => <label className={action === choice.id ? "reminder-choice selected" : "reminder-choice"} key={choice.id}><input type="radio" name="reminder-action" checked={action === choice.id} onChange={() => setAction(choice.id)} /><span>{choice.label}</span></label>)}
      </fieldset>
      {action === "reschedule" && <label>New date and time
        <input type="datetime-local" required value={date} min={toLocal(new Date())} onChange={(event) => setDate(event.target.value)} />
      </label>}
      {action === "snooze" && <label>Remind after (minutes)
        <input type="number" min={1} max={1440} required value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
      </label>}
      {kind === "habit" && action === "complete" && habit && (habit.measurement_type === "quantity" || habit.measurement_type === "duration") && <label>{habit.unit ? `Progress (${habit.unit})` : "Progress"}
        <input type="number" min={0} step="0.001" required value={value} onChange={(event) => setValue(event.target.value)} />
      </label>}
      {kind === "habit" && (action === "complete" || action === "skip") && <label>{action === "skip" ? "Reason for skipping" : habit?.daily_note_required || habit?.measurement_type === "text" ? "Note or response" : "Note or response (optional)"}
        <input type="text" required={action === "skip" || Boolean(habit?.daily_note_required) || habit?.measurement_type === "text"} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>}
      <div className="reminder-footer">
        <button className="btn pri" disabled={busy || loading}>{busy ? "Saving…" : "Apply action"}</button>
        <button className="btn" type="button" onClick={goBack}>Cancel</button>
      </div>
    </form>
    </section>
  </main>;
}
