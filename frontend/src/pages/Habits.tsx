import { useState } from "react";
import { Flame, Plus, Trash2 } from "lucide-react";
import { Card, CardHead, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Progress, Skeleton, confetti, type FieldDef } from "../components/ui";
import { HabitProgressChart, Heatmap } from "../components/charts";
import { useCheckHabit, useCreateHabit, useDeleteHabit, useHabitEntries, useHabitInsights, useHabits, useUpdateHabit } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { addDays, isoDate } from "../lib/format";
import type { Habit } from "../lib/types";

function HabitHistory({ id, name }: { id: string; name: string }) {
  const entries = useHabitEntries(id);
  const done = new Set((entries.data ?? []).filter((e) => e.status === "completed").map((e) => e.entry_date.slice(0, 10)));
  const days = Array.from({ length: 35 }, (_, i) => addDays(new Date(), i - 34));
  if (entries.isLoading) return <Skeleton rows={2} />;
  if (entries.isError) return <ErrorBox error={entries.error} retry={() => void entries.refetch()} />;
  return <Heatmap name={name} values={days.map(d => Number(done.has(isoDate(d))))} cells={days.map((d) => (done.has(isoDate(d)) ? 4 : 0))} startWeekday={days[0].getDay()} tips={days.map((d) => `${d.toLocaleDateString("en", { day: "numeric", month: "short" })}\n${done.has(isoDate(d)) ? "Done" : "—"}`)} />;
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const parseWeekdays = (value: string) => [...new Set(value.toLowerCase().split(/[\s,]+/).map((token) => WEEKDAYS.indexOf(token.slice(0, 3))).filter((day) => day >= 0))];
const parseMonthDays = (value: string) => [...new Set(value.split(/[\s,]+/).map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))];

function frequencyOf(habit: Habit): string {
  if (habit.schedule_type === "daily") return "daily";
  const days = habit.schedule_config?.weekdays ?? [];
  if (days.join(",") === "0,1,2,3,4") return "weekdays";
  if (days.join(",") === "5,6") return "weekends";
  return "custom";
}

function habitFields(): FieldDef[] {
  return [
    { name: "name", label: "Title", required: true, placeholder: "Read, walk, drink water…" },
    { name: "question", label: "Question", placeholder: "Did you complete it today?", required: true },
    { name: "description", label: "What it is and why", type: "textarea" },
    { name: "measurement_type", label: "Type", type: "select", options: [["boolean", "Checklist / Yes–No"], ["quantity", "Measurable"], ["duration", "Measurable duration"], ["text", "Text / note"]], half: true },
    { name: "unit", label: "Unit", type: "select", options: [["", "None"], ["number", "Number"], ["todo", "Todo list"], ["alphabets", "Alphabets"], ["minutes", "Minutes"], ["pages", "Pages"], ["custom", "Other"]], half: true },
    { name: "target_value", label: "Target value", type: "number", step: "0.01", min: 0, half: true },
    { name: "target_type", label: "Target", type: "select", options: [["at_least", "At least"], ["at_most", "At most"]], half: true },
    { name: "frequency", label: "Frequency", type: "select", options: [["daily", "Every day"], ["weekdays", "Monday–Friday"], ["weekends", "Saturday and Sunday"], ["custom", "Custom weekdays"]], half: true },
    { name: "custom_weekdays", label: "Custom weekdays", placeholder: "Mon, Wed, Fri", half: true },
    { name: "reminder", label: "Reminder", type: "select", options: [["none", "None"], ["daily", "Daily"], ["monthly_once", "Monthly once"], ["monthly_twice", "Monthly twice"], ["custom", "Custom weekdays"]], half: true },
    { name: "reminder_time", label: "Reminder time", type: "time", half: true },
    { name: "reminder_days", label: "Monthly day(s)", placeholder: "1, 15", half: true },
    { name: "reminder_weekdays", label: "Reminder weekdays", placeholder: "Tue, Thu", half: true },
    { name: "daily_note_required", label: "Daily note", type: "select", options: [["no", "Optional"], ["yes", "Required"]], half: true },
  ];
}

function habitPayload(v: Record<string, string>) {
  const customDays = parseWeekdays(v.custom_weekdays || "");
  const scheduleDays = v.frequency === "weekdays" ? [0, 1, 2, 3, 4] : v.frequency === "weekends" ? [5, 6] : customDays;
  const scheduleType = v.frequency === "daily" ? "daily" : v.frequency === "custom" ? "custom" : "weekly";
  const reminder: Record<string, unknown> = { type: v.reminder || "none" };
  if (v.reminder && v.reminder !== "none") reminder.time = v.reminder_time || "09:00";
  if (v.reminder === "monthly_once" || v.reminder === "monthly_twice") reminder.days = parseMonthDays(v.reminder_days || "");
  if (v.reminder === "custom") reminder.weekdays = parseWeekdays(v.reminder_weekdays || "");
  return {
    name: v.name.trim(),
    question: v.question.trim(),
    description: v.description,
    measurement_type: v.measurement_type,
    target_value: v.target_value ? Number(v.target_value) : null,
    target_type: v.target_type,
    unit: v.unit || null,
    schedule_type: scheduleType,
    schedule_config: scheduleType === "daily" ? {} : { weekdays: scheduleDays },
    frequency_config: { type: v.frequency, weekdays: scheduleDays },
    reminder_config: reminder,
    daily_note_required: v.daily_note_required === "yes",
  };
}

function habitInitial(habit: Habit): Record<string, string> {
  const reminder = habit.reminder_config ?? {};
  const reminderDays = Array.isArray(reminder.days) ? reminder.days.join(", ") : "";
  const reminderWeekdays = Array.isArray(reminder.weekdays)
    ? reminder.weekdays.map((day) => WEEKDAYS[Number(day)]).filter(Boolean).join(", ")
    : "";
  return {
    name: habit.name,
    question: habit.question,
    description: habit.description,
    measurement_type: habit.measurement_type,
    unit: habit.unit ?? "",
    target_value: habit.target_value == null ? "" : String(habit.target_value),
    target_type: habit.target_type,
    frequency: frequencyOf(habit),
    custom_weekdays: (habit.schedule_config?.weekdays ?? []).map((day) => WEEKDAYS[day]).filter(Boolean).join(", "),
    reminder: String(reminder.type ?? "none"),
    reminder_time: String(reminder.time ?? "09:00"),
    reminder_days: reminderDays,
    reminder_weekdays: reminderWeekdays,
    daily_note_required: habit.daily_note_required ? "yes" : "no",
  };
}

export default function Habits() {
  const habits = useHabits();
  const insights = useHabitInsights(42);
  const create = useCreateHabit();
  const check = useCheckHabit();
  const remove = useDeleteHabit();
  const update = useUpdateHabit();
  const [isNew, closeNew, showNew] = useNewParam();
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [logging, setLogging] = useState<Habit | null>(null);
  const [skipping, setSkipping] = useState<Habit | null>(null);
  const [skipNote, setSkipNote] = useState("");
  const [editing, setEditing] = useState<Habit | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Set<string>>(() => new Set());
  const list = habits.data ?? [];
  const done = list.filter((h) => h.completed_today).length;

  return (
    <>
      <PageHead title="Habits" sub={list.length ? `${done} of ${list.length} done today` : "Small things, done daily"}><button className="btn pri" onClick={showNew}><Plus className="ic" />New habit</button></PageHead>
      {habits.isLoading ? <Card><Skeleton rows={4} /></Card> : habits.isError ? <ErrorBox error={habits.error} retry={() => void habits.refetch()} /> : list.length === 0 ? <Card><Empty title="No habits yet" hint="Pick one small habit and check in daily to build a streak." action={<button className="btn pri sm" onClick={showNew}>Create habit</button>} /></Card> : (
        <div className="pc habit-grid">{list.map((h, i) => (
          <Card key={h.id} i={i} className="habit-card" tone={h.completed_today ? "mint" : undefined}>
            <div className="row sb"><button type="button" className="habit-name" onClick={() => setEditing(h)} aria-label={`Edit ${h.name}`}><h3>{h.name}</h3></button><div className="row"><span className="pill md"><Flame className="ic" style={{ width: 12, height: 12 }} />{h.current_streak}d</span><button className="iconbtn" aria-label={`Archive ${h.name}`} onClick={() => setDeleting(h)}><Trash2 className="ic" style={{ width: 14, height: 14 }} /></button></div></div>
            <p className="mute sm" style={{ margin: "4px 0 12px" }}>{h.description || (h.schedule_type === "daily" ? "Every day" : "Scheduled days")}</p>
            <Progress value={h.consistency_30d} label={h.name + " consistency"} detail={`${Math.round(h.consistency_30d * h.scheduled_days_30d / 100)} of ${h.scheduled_days_30d} eligible days completed in the last 30 days. Skipped days are excluded.`} />
            <div className="row sb sm mute" style={{ margin: "8px 0 12px" }}><span>30-day consistency</span><b className="num">{h.consistency_30d}%</b></div>
            <div className="row wrap">
              <button className={`btn sm ${h.completed_today ? "" : "pri"}`} disabled={check.isPending} onClick={(e) => h.measurement_type === "boolean" && !h.daily_note_required ? check.mutate({ id: h.id, status: "completed" }, { onSuccess: () => confetti(e.currentTarget) }) : setLogging(h)}>Input</button>
              <button className="btn sm ghost" disabled={check.isPending} onClick={() => check.mutate({ id: h.id, status: "missed", value: 0 })}>Decline</button>
              <button className="btn sm ghost" disabled={check.isPending} onClick={() => { setSkipping(h); setSkipNote(""); }}>Skip</button>
            </div>
            <button type="button" className="btn sm habit-history-toggle" style={{ marginTop: 12 }} aria-expanded={historyOpen.has(h.id)} onClick={() => setHistoryOpen((current) => { const next = new Set(current); next.has(h.id) ? next.delete(h.id) : next.add(h.id); return next; })}>{historyOpen.has(h.id) ? "Hide progress" : "View progress"}</button>
            {historyOpen.has(h.id) && <div className="habit-history-panel"><HabitHistory id={h.id} name={h.name} /></div>}
          </Card>
        ))}</div>
      )}
      <Card className="s12 habit-combined-card"><CardHead mono="All habits" title="Combined progress" />{insights.isError ? <ErrorBox error={insights.error} retry={() => void insights.refetch()} /> : insights.isLoading ? <Skeleton rows={3} /> : insights.data?.series?.some((point) => point.completed || point.skipped || point.scheduled || point.active) ? <HabitProgressChart points={insights.data.series} /> : <Empty title="No habit activity yet" hint="Check in a habit to start the combined chart." />}</Card>
      {isNew && <FormModal title="New habit" busy={create.isPending} onClose={closeNew}
        initial={{ measurement_type: "boolean", target_type: "at_least", frequency: "daily", reminder: "none", reminder_time: "09:00", daily_note_required: "no" }}
        fields={habitFields()}
        onSubmit={(v) => create.mutate(habitPayload(v), { onSuccess: closeNew })} />}
      {editing && <FormModal title="Edit habit" submit="Save changes" busy={update.isPending} onClose={() => setEditing(null)}
        initial={habitInitial(editing)}
        fields={habitFields()}
        onSubmit={(v) => update.mutate({ id: editing.id, ...habitPayload(v) }, { onSuccess: () => setEditing(null) })} />}
      {logging && <FormModal title={`Log ${logging.name}`} busy={check.isPending} onClose={() => setLogging(null)} fields={[...(logging.measurement_type === "boolean" || logging.measurement_type === "text" ? [] : [{ name: "value", label: logging.unit ? `Amount (${logging.unit})` : "Amount", type: "number" as const, step: "0.01", min: 0, required: true }]), ...(logging.daily_note_required || logging.measurement_type === "text" ? [{ name: "note", label: "What did you do?", type: "textarea" as const, required: true }] : [])]} onSubmit={(v) => check.mutate({ id: logging.id, status: "completed", value: v.value ? Number(v.value) : null, note: v.note }, { onSuccess: () => { confetti(); setLogging(null); } })} />}
      {skipping && <FormModal title={`Skip ${skipping.name}`} busy={check.isPending} onClose={() => setSkipping(null)}
        fields={[{ name: "note", label: "Why are you skipping today?", type: "textarea", required: true }]}
        onSubmit={(v) => check.mutate({ id: skipping.id, status: "skipped", note: v.note.trim() }, { onSuccess: () => setSkipping(null) })} />}
      {deleting && <ConfirmModal title="Archive habit?" body={`“${deleting.name}” will be archived. Your history is kept.`} confirm="Archive" onConfirm={() => remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />}
    </>
  );
}
