import { useState } from "react";
import { Flame, Plus, Trash2 } from "lucide-react";
import { Card, ConfirmModal, Empty, ErrorBox, FormModal, PageHead, Progress, Skeleton, confetti } from "../components/ui";
import { Heatmap } from "../components/charts";
import { useCheckHabit, useCreateHabit, useDeleteHabit, useHabitEntries, useHabits } from "../hooks/data";
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
  const create = useCreateHabit();
  const check = useCheckHabit();
  const remove = useDeleteHabit();
  const [isNew, closeNew, showNew] = useNewParam();
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const list = habits.data ?? [];
  const done = list.filter((h) => h.completed_today).length;

  return (
    <>
      <PageHead title="Habits" sub={list.length ? `${done} of ${list.length} done today` : "Small things, done daily"}><button className="btn pri" onClick={showNew}><Plus className="ic" />New habit</button></PageHead>
      {habits.isLoading ? <Card><Skeleton rows={4} /></Card> : habits.isError ? <ErrorBox error={habits.error} retry={() => void habits.refetch()} /> : list.length === 0 ? <Card><Empty title="No habits yet" hint="Pick one small habit and check in daily to build a streak." action={<button className="btn pri sm" onClick={showNew}>Create habit</button>} /></Card> : (
        <div className="pc">{list.map((h, i) => (
          <Card key={h.id} i={i} tone={h.completed_today ? "mint" : undefined}>
            <div className="row sb"><h3>{h.name}</h3><span className="pill md"><Flame className="ic" style={{ width: 12, height: 12 }} />{h.current_streak}d</span></div>
            <p className="mute sm" style={{ margin: "4px 0 12px" }}>{h.description || (h.schedule_type === "daily" ? "Every day" : "Scheduled days")}</p>
            <Progress value={h.consistency_30d} />
            <div className="row sb sm mute" style={{ margin: "8px 0 12px" }}><span>30-day consistency</span><b className="num">{h.consistency_30d}%</b></div>
            <div className="row wrap">
              <button className={`btn sm ${h.completed_today ? "" : "pri"}`} disabled={check.isPending} onClick={(e) => { check.mutate({ id: h.id, status: h.completed_today ? "missed" : "completed" }); if (!h.completed_today) confetti(e.currentTarget); }}>{h.completed_today ? "Undo today" : "Check in"}</button>
              <button className="btn sm ghost" onClick={() => setOpen(open === h.id ? null : h.id)}>{open === h.id ? "Hide history" : "History"}</button>
              <button className="btn sm ghost" aria-label={`Archive ${h.name}`} onClick={() => setDeleting(h)}><Trash2 className="ic" style={{ width: 14, height: 14 }} /></button>
            </div>
            {open === h.id && <div style={{ marginTop: 14 }}><HabitHistory id={h.id} /></div>}
          </Card>
        ))}</div>
      )}
      {isNew && <FormModal title="New habit" busy={create.isPending} onClose={closeNew} fields={[{ name: "name", label: "Habit", required: true, placeholder: "e.g. Read 20 pages" }, { name: "description", label: "Why it matters", type: "textarea" }]} onSubmit={(v) => create.mutate({ name: v.name.trim(), description: v.description }, { onSuccess: closeNew })} />}
      {deleting && <ConfirmModal title="Archive habit?" body={`“${deleting.name}” will be archived. Your history is kept.`} confirm="Archive" onConfirm={() => remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />}
    </>
  );
}
