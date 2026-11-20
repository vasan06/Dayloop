import { useState } from "react";
import { Flame, Plus, Trash2 } from "lucide-react";
import { Card, CardHead, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Progress, Skeleton, confetti } from "../components/ui";
import { HabitProgressChart, Heatmap } from "../components/charts";
import { useCheckHabit, useCreateHabit, useDeleteHabit, useHabitEntries, useHabitInsights, useHabits, useUpdateHabit } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { addDays, isoDate } from "../lib/format";
import type { Habit } from "../lib/types";

function HabitHistory({ id }: { id: string }) {
  const entries = useHabitEntries(id);
  const done = new Set((entries.data ?? []).filter((e) => e.status === "completed").map((e) => e.entry_date.slice(0, 10)));
  const days = Array.from({ length: 35 }, (_, i) => addDays(new Date(), i - 34));
  return <Heatmap cells={days.map((d) => (done.has(isoDate(d)) ? 4 : 0))} startWeekday={days[0].getDay()} tips={days.map((d) => `${d.toLocaleDateString("en", { day: "numeric", month: "short" })}\n${done.has(isoDate(d)) ? "Done" : "—"}`)} />;
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
  const list = habits.data ?? [];
  const done = list.filter((h) => h.completed_today).length;

  return (
    <>
      <PageHead title="Habits" sub={list.length ? `${done} of ${list.length} done today` : "Small things, done daily"}><button className="btn pri" onClick={showNew}><Plus className="ic" />New habit</button></PageHead>
      <Card className="s12"><CardHead mono="All habits" title="Combined progress" />{insights.isError ? <ErrorBox error={insights.error} retry={() => void insights.refetch()} /> : insights.isLoading ? <Skeleton rows={3} /> : insights.data?.series?.some((point) => point.completed || point.skipped || point.scheduled || point.active) ? <HabitProgressChart points={insights.data.series} /> : <Empty title="No habit activity yet" hint="Check in a habit to start the combined chart." />}</Card>
      {habits.isLoading ? <Card><Skeleton rows={4} /></Card> : habits.isError ? <ErrorBox error={habits.error} retry={() => void habits.refetch()} /> : list.length === 0 ? <Card><Empty title="No habits yet" hint="Pick one small habit and check in daily to build a streak." action={<button className="btn pri sm" onClick={showNew}>Create habit</button>} /></Card> : (
        <div className="pc">{list.map((h, i) => (
          <Card key={h.id} i={i} tone={h.completed_today ? "mint" : undefined}>
            <div className="row sb"><button type="button" className="lnk" onClick={() => setEditing(h)} aria-label={`Edit ${h.name}`}><h3>{h.name}</h3></button><div className="row"><span className="pill md"><Flame className="ic" style={{ width: 12, height: 12 }} />{h.current_streak}d</span><button className="iconbtn" aria-label={`Archive ${h.name}`} onClick={() => setDeleting(h)}><Trash2 className="ic" style={{ width: 14, height: 14 }} /></button></div></div>
            <p className="mute sm" style={{ margin: "4px 0 12px" }}>{h.description || (h.schedule_type === "daily" ? "Every day" : "Scheduled days")}</p>
            <Progress value={h.consistency_30d} />
            <div className="row sb sm mute" style={{ margin: "8px 0 12px" }}><span>30-day consistency</span><b className="num">{h.consistency_30d}%</b></div>
            <div className="row wrap">
              <button className={`btn sm ${h.completed_today ? "" : "pri"}`} disabled={check.isPending} onClick={(e) => h.measurement_type === "boolean" ? check.mutate({ id: h.id, status: "completed" }, { onSuccess: () => confetti(e.currentTarget) }) : setLogging(h)}>Input</button>
              <button className="btn sm ghost" disabled={check.isPending} onClick={() => check.mutate({ id: h.id, status: "missed", value: 0 })}>Decline</button>
              <button className="btn sm ghost" disabled={check.isPending} onClick={() => { setSkipping(h); setSkipNote(""); }}>Skip</button>
            </div>
            <div style={{ marginTop: 14 }}><HabitHistory id={h.id} /></div>
          </Card>
        ))}</div>
      )}
      {isNew && <FormModal title="New habit" busy={create.isPending} onClose={closeNew}
        fields={[
          { name: "name", label: "Title", required: true, placeholder: "Read, walk, drink water…" },
          { name: "question", label: "Question", placeholder: "Did you complete it today?", required: true },
          { name: "description", label: "What it is and why", type: "textarea" },
          { name: "measurement_type", label: "Type", type: "select", options: [["boolean", "Checklist / Yes–No"], ["quantity", "Measurable"], ["duration", "Measurable duration"], ["text", "Text / note"]], half: true },
          { name: "unit", label: "Unit", type: "select", options: [["", "None"], ["number", "Number"], ["todo", "Todo list"], ["alphabets", "Alphabets"], ["minutes", "Minutes"], ["pages", "Pages"], ["custom", "Other"]], half: true },
          { name: "target_value", label: "Target value", type: "number", step: "0.01", min: 0, half: true },
          { name: "target_type", label: "Target", type: "select", options: [["at_least", "At least"], ["at_most", "At most"]], half: true },
          { name: "frequency", label: "Frequency", type: "select", options: [["daily", "Every day"], ["weekdays", "Sunday–Saturday"], ["custom", "Custom"]], half: true },
          { name: "reminder", label: "Reminder", type: "select", options: [["none", "None"], ["daily", "Daily"], ["monthly_once", "Monthly once"], ["monthly_twice", "Monthly twice"], ["custom", "Custom / range"]], half: true },
        ]}
        onSubmit={(v) => create.mutate({
          name: v.name.trim(),
          question: v.question.trim(),
          description: v.description,
          measurement_type: v.measurement_type,
          target_value: v.target_value ? Number(v.target_value) : null,
          target_type: v.target_type,
          unit: v.unit || null,
          schedule_type: v.frequency === "daily" ? "daily" : "weekly",
          schedule_config: v.frequency === "weekdays" ? { weekdays: [0, 1, 2, 3, 4, 5, 6] } : {},
          frequency_config: { type: v.frequency },
          reminder_config: { type: v.reminder },
        }, { onSuccess: closeNew })} />}
      {editing && <FormModal title="Edit habit" submit="Save changes" busy={update.isPending} onClose={() => setEditing(null)}
        initial={{ name: editing.name, question: editing.question, description: editing.description, measurement_type: editing.measurement_type, unit: editing.unit ?? "", target_value: editing.target_value ? String(editing.target_value) : "", target_type: editing.target_type }}
        fields={[
          { name: "name", label: "Title", required: true },
          { name: "question", label: "Question", required: true },
          { name: "description", label: "What it is and why", type: "textarea" },
          { name: "measurement_type", label: "Type", type: "select", options: [["boolean", "Checklist / Yes–No"], ["quantity", "Measurable"], ["duration", "Measurable duration"], ["text", "Text / note"]], half: true },
          { name: "unit", label: "Unit", type: "text", half: true },
          { name: "target_value", label: "Target value", type: "number", step: "0.01", min: 0, half: true },
          { name: "target_type", label: "Target", type: "select", options: [["at_least", "At least"], ["at_most", "At most"]], half: true },
        ]}
        onSubmit={(v) => update.mutate({
          id: editing.id,
          name: v.name.trim(),
          question: v.question.trim(),
          description: v.description,
          measurement_type: v.measurement_type,
          unit: v.unit || null,
          target_value: v.target_value ? Number(v.target_value) : null,
          target_type: v.target_type,
        }, { onSuccess: () => setEditing(null) })} />}
      {logging && <FormModal title={`Log ${logging.name}`} busy={check.isPending} onClose={() => setLogging(null)} fields={logging.measurement_type === "text" ? [{ name: "note", label: "What did you do?", type: "textarea", required: true }] : [{ name: "value", label: logging.unit ? `Amount (${logging.unit})` : "Amount", type: "number", step: "0.01", min: 0, required: true }]} onSubmit={(v) => check.mutate({ id: logging.id, status: "completed", value: v.value ? Number(v.value) : null, note: v.note }, { onSuccess: () => { setLogging(null); } })} />}
      {skipping && <FormModal title={`Skip ${skipping.name}`} busy={check.isPending} onClose={() => setSkipping(null)}
        fields={[{ name: "note", label: "Why are you skipping today?", type: "textarea", required: true }]}
        onSubmit={(v) => check.mutate({ id: skipping.id, status: "skipped", note: v.note.trim() }, { onSuccess: () => setSkipping(null) })} />}
      {deleting && <ConfirmModal title="Archive habit?" body={`“${deleting.name}” will be archived. Your history is kept.`} confirm="Archive" onConfirm={() => remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />}
    </>
  );
}
