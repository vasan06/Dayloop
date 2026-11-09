import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Card, CardHead, Empty, FormModal, PageHead } from "../components/ui";
import { useCreateEvent, useDeleteEvent, useEvents, useTasks } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { dayKey, isoDate, shortDate, timeOf } from "../lib/format";

const iso = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString().replace("Z", "+00:00");

export default function Calendar() {
  const events = useEvents();
  const tasks = useTasks();
  const create = useCreateEvent();
  const remove = useDeleteEvent();
  const [isNew, closeNew, showNew] = useNewParam();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState(isoDate());

  const byDay = useMemo(() => {
    const map = new Map<string, { events: NonNullable<typeof events.data>; tasks: NonNullable<typeof tasks.data> }>();
    const slot = (k: string) => { if (!map.has(k)) map.set(k, { events: [], tasks: [] }); return map.get(k)!; };
    (events.data ?? []).forEach((e) => slot(dayKey(e.start_at)).events.push(e));
    (tasks.data ?? []).filter((t) => t.due_at && t.status !== "completed" && t.status !== "cancelled").forEach((t) => slot(dayKey(t.due_at)).tasks.push(t));
    return map;
  }, [events.data, tasks.data]);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))];
  const sel = byDay.get(selected);

  return (
    <>
      <PageHead title="Calendar" sub="Events and task deadlines in one place"><button className="btn pri" onClick={showNew}><Plus className="ic" />New event</button></PageHead>
      <div className="g">
        <Card className="s8">
          <CardHead title={cursor.toLocaleDateString("en", { month: "long", year: "numeric" })} right={<div className="row"><button className="iconbtn" style={{ width: 34, height: 34 }} aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="ic" /></button><button className="btn sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelected(isoDate()); }}>Today</button><button className="iconbtn" style={{ width: 34, height: 34 }} aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="ic" /></button></div>} />
          <div className="cal">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="hd">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={`b${i}`} style={{ visibility: "hidden" }} />;
              const key = isoDate(d); const info = byDay.get(key);
              return (
                <div key={key} role="button" tabIndex={0} className={`${key === isoDate() ? "td" : ""} ${key === selected ? "sel" : ""}`} onClick={() => setSelected(key)} onKeyDown={(e) => e.key === "Enter" && setSelected(key)}>
                  <span className="d">{d.getDate()}</span>
                  {info?.events.slice(0, 2).map((e) => <span key={e.id} className="e">{e.title}</span>)}
                  {info?.tasks.slice(0, 1).map((t) => <span key={t.id} className="e t">{t.title}</span>)}
                  {info && info.events.length + info.tasks.length > 3 && <span className="mono">+{info.events.length + info.tasks.length - 3}</span>}
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="s4">
          <CardHead mono={shortDate(selected + "T00:00")} title="Agenda" />
          {!sel || sel.events.length + sel.tasks.length === 0 ? <Empty title="Free day" hint="Nothing scheduled." action={<button className="btn sm" onClick={showNew}>Add event</button>} /> : <div className="tl">
            {sel.events.map((e) => <div className="ev" key={e.id}><div className="row sb"><b>{e.title}</b><button className="iconbtn" style={{ width: 28, height: 28 }} aria-label={`Delete ${e.title}`} onClick={() => remove.mutate(e.id)}><Trash2 className="ic" style={{ width: 13, height: 13 }} /></button></div><div className="mono">{timeOf(e.start_at)} – {timeOf(e.end_at)}</div></div>)}
            {sel.tasks.map((t) => <div className="ev" key={t.id}><b>{t.title}</b><div className="mono">Task due</div></div>)}
          </div>}
        </Card>
      </div>
      {isNew && <FormModal title="New event" busy={create.isPending} onClose={closeNew} initial={{ date: selected, start: "10:00", end: "11:00" }} fields={[{ name: "title", label: "Title", required: true }, { name: "description", label: "Details", type: "textarea" }, { name: "date", label: "Date", type: "date", required: true }, { name: "start", label: "Starts", type: "text", placeholder: "HH:MM", half: true, required: true }, { name: "end", label: "Ends", type: "text", placeholder: "HH:MM", half: true, required: true }]} onSubmit={(v) => create.mutate({ title: v.title.trim(), description: v.description, start_at: iso(v.date, v.start), end_at: iso(v.date, v.end) }, { onSuccess: closeNew })} />}
    </>
  );
}
