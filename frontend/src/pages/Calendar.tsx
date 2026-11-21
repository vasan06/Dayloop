import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Trash2, ArrowUpRight, ListTodo, CircleCheckBig, RotateCcw } from "lucide-react";
import { Card, Empty, ErrorBox, FormModal, PageHead, Skeleton, confetti } from "../components/ui";
import { useCreateEvent, useDeleteEvent, useEvents, useTasks, useUpdateEvent } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { addDays, dayKey, isoDate, shortDate, timeOf } from "../lib/format";
import { toast } from "../lib/toast";

type CalendarView = "month" | "week" | "day";
type DayItems = { events: NonNullable<ReturnType<typeof useEvents>["data"]>; tasks: NonNullable<ReturnType<typeof useTasks>["data"]> };

function initialView(): CalendarView {
  try {
    const saved = localStorage.getItem("dl-calendar-view");
    if (saved === "day" || saved === "week" || saved === "month") return saved;
  } catch { /* Private browsing can disable storage. */ }
  return matchMedia("(max-width: 640px)").matches ? "week" : "month";
}

const startOfWeek = (date: Date) => { const next = new Date(date); next.setHours(0,0,0,0); next.setDate(next.getDate() - ((next.getDay()+6)%7)); return next; };
const labelDate = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en", options);
const hourLabel = (hour: number) => new Date(2000,0,1,hour).toLocaleTimeString("en",{hour:"numeric",hour12:true});
const isOpenTask = (task: {status:string;due_at:string|null}) => Boolean(task.due_at && task.status !== "completed" && task.status !== "cancelled");

export default function Calendar() {
  const events = useEvents();
  const tasks = useTasks();
  const create = useCreateEvent();
  const remove = useDeleteEvent();
  const updateEvent = useUpdateEvent();
  const [isNew, closeNew, showNew] = useNewParam();
  const [selected, setSelected] = useState(isoDate());
  const [view, setView] = useState<CalendarView>(initialView);

  const byDay = useMemo(() => {
    const map = new Map<string, DayItems>();
    const slot = (key: string) => {
      if (!map.has(key)) map.set(key,{events:[],tasks:[]});
      return map.get(key)!;
    };
    (events.data ?? []).forEach(event => slot(dayKey(event.start_at)).events.push(event));
    (tasks.data ?? []).filter(isOpenTask).forEach(task => slot(dayKey(task.due_at!)).tasks.push(task));
    return map;
  },[events.data,tasks.data]);

  const selectedDate = new Date(selected+"T12:00:00");
  const monthStart = new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
  const monthDays = Array.from({length:42},(_,i)=>addDays(startOfWeek(monthStart),i));
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const selectedItems = byDay.get(selected) ?? {events:[],tasks:[]};
  const selectedEvents = [...selectedItems.events].sort((a,b)=>a.start_at.localeCompare(b.start_at));
  const selectedTasks = [...selectedItems.tasks].sort((a,b)=>(a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const itemCount = (key:string) => { const value=byDay.get(key); return (value?.events.length ?? 0)+(value?.tasks.length ?? 0); };
  const shift = (direction: number) => {
    if (view === "month") {
      const last = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction + 1, 0);
      last.setDate(Math.min(selectedDate.getDate(), last.getDate()));
      setSelected(isoDate(last));
    } else {
      setSelected(isoDate(addDays(selectedDate, direction * (view === "week" ? 7 : 1))));
    }
  };
  const goToday = () => setSelected(isoDate());
  const changeView = (next: CalendarView) => {
    setView(next);
    try { localStorage.setItem("dl-calendar-view", next); } catch { /* The view still works for this session. */ }
  };
  const heading = view === "day"
    ? labelDate(selectedDate,{weekday:"long",day:"numeric",month:"long",year:"numeric"})
    : view === "week"
      ? labelDate(weekStart,{day:"numeric",month:"short"})+" – "+labelDate(addDays(weekStart,6),{day:"numeric",month:"short",year:"numeric"})
      : labelDate(selectedDate,{month:"long",year:"numeric"});

  const chooseDate = (date: Date) => setSelected(isoDate(date));
  const dayCell = (date:Date) => {
    const key=isoDate(date), count=itemCount(key), data=byDay.get(key);
    const isToday=key===isoDate(), isSelected=key===selected;
    return <button type="button" key={key} className={"cal-month-day"+(isSelected?" selected":"")+(isToday?" today":"")+(date.getMonth()!==selectedDate.getMonth()?" outside":"")} onClick={()=>chooseDate(date)} aria-pressed={isSelected} aria-label={labelDate(date,{weekday:"long",month:"long",day:"numeric"})+", "+count+" scheduled items"}>
      <span className="cal-date-number">{date.getDate()}</span>
      <span className="cal-day-meta">{count ? count+" item"+(count===1?"":"s") : " "}</span>
      <span className="cal-day-dots">{(data?.events.length ?? 0)>0 && <i className="event" />}{(data?.tasks.length ?? 0)>0 && <i className="deadline" />}{count>2 && <small>+{count-2}</small>}</span>
      <span className="cal-day-preview">{(data?.events ?? []).slice(0,1).map(event=><span className="cal-event-preview" key={event.id}>{event.title}</span>)}{(data?.tasks ?? []).slice(0,1).map(task=><span className="cal-task-preview" key={task.id}>{task.title}</span>)}</span>
    </button>;
  };

  const dayEvents = selectedEvents;
  const outsideHours = dayEvents.filter(event => { const hour=new Date(event.start_at).getHours(); return hour<7 || hour>21; });

  return <>
    <PageHead title="Calendar">
      <button className="btn pri" onClick={showNew}><Plus className="ic" />New event</button>
    </PageHead>
    <div className="cal-layout">
      <Card className="cal-calendar-card">
        <div className="cal-calendar-head">
          <div className="cal-heading-group"><span className="cal-heading-icon"><CalendarDays /></span><div><h2 aria-live="polite">{heading}</h2></div></div>
          <div className="cal-toolbar-actions">
            <div className="cal-view-switch" role="group" aria-label="Calendar view">
              {(["month","week","day"] as const).map(item=><button type="button" key={item} className={view===item?"active":""} aria-pressed={view===item} onClick={()=>changeView(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}
            </div>
            <div className="cal-period-actions"><button className="btn sm" onClick={goToday}>Today</button><button className="iconbtn" aria-label="Previous period" onClick={()=>shift(-1)}><ChevronLeft className="ic" /></button><button className="iconbtn" aria-label="Next period" onClick={()=>shift(1)}><ChevronRight className="ic" /></button></div>
          </div>
        </div>
        {events.isError ? <ErrorBox error={events.error} retry={()=>void events.refetch()} /> : tasks.isError ? <ErrorBox error={tasks.error} retry={()=>void tasks.refetch()} /> : events.isLoading||tasks.isLoading ? <Skeleton rows={5} /> : <>
          {view==="month" && <div className="cal-month-view"><div className="cal-weekday-row">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><span key={day}>{day}</span>)}</div><div className="cal-month-grid">{monthDays.map(dayCell)}</div></div>}
          {view==="week" && <div className="cal-week-view">{weekDays.map(date=>{const key=isoDate(date),data=byDay.get(key),count=itemCount(key);return <button type="button" key={key} className={"cal-week-day"+(key===selected?" selected":"")+(key===isoDate()?" today":"")} aria-pressed={key===selected} aria-label={labelDate(date,{weekday:"long",month:"long",day:"numeric"})+", "+count+" scheduled items"} onClick={()=>chooseDate(date)}><span className="cal-week-dayname">{labelDate(date,{weekday:"short"})}</span><strong>{date.getDate()}</strong><small>{count?count+" items":"Clear"}</small><span className="cal-week-events">{(data?.events??[]).slice(0,3).map(event=><i key={event.id}>{timeOf(event.start_at)} · {event.title}</i>)}{(data?.tasks??[]).slice(0,2).map(task=><i className="deadline" key={task.id}>{task.title}</i>)}</span><span className="cal-week-dots">{(data?.events.length??0)>0&&<i/>}{(data?.tasks.length??0)>0&&<i className="deadline"/>}</span></button>})}</div>}
          {view==="day" && <div className="cal-day-view"><div className="cal-day-banner"><div><span className="cal-eyebrow">SELECTED DAY</span><h3>{labelDate(selectedDate,{weekday:"long",day:"numeric",month:"long"})}</h3></div><span className="cal-day-count">{dayEvents.length} event{dayEvents.length===1?"":"s"}</span></div><div className="cal-timeline">{Array.from({length:15},(_,i)=>i+7).map(hour=>{const hourEvents=dayEvents.filter(event=>new Date(event.start_at).getHours()===hour);return <div className="cal-time-row" key={hour}><span className="cal-time-label">{hourLabel(hour)}</span><div className="cal-time-slot">{hourEvents.length?hourEvents.map(event=><div className="cal-timeline-event" key={event.id}><b>{event.title}</b><small>{timeOf(event.start_at)} – {timeOf(event.end_at)}</small>{event.description&&<p>{event.description}</p>}</div>):<span className="cal-time-empty" />}</div></div>})}</div>{outsideHours.length>0&&<div className="cal-outside-hours"><b>Outside the timeline</b>{outsideHours.map(event=><span key={event.id}>{timeOf(event.start_at)} · {event.title}</span>)}</div>}</div>}
        </>}
        <div className="cal-legend"><span><i className="event" />Events</span><span><i className="deadline" />Task deadlines</span><span className="cal-legend-hint">Select a date to inspect its agenda</span></div>
      </Card>
      <aside className="cal-side">
        <Card className="cal-agenda-card">
          <div className="cal-side-head"><div><h3>Day agenda</h3><small>{shortDate(selected+"T12:00:00")}</small></div></div>
          <div className="cal-agenda-totals"><b>{selectedEvents.length+selectedTasks.length}</b><span><strong>planned items</strong><small>{selectedEvents.length} events · {selectedTasks.length} deadlines</small></span></div>
          {selectedEvents.length===0&&selectedTasks.length===0 ? <Empty title="No plans for this day" hint="Events and task deadlines appear here." /> : <div className="cal-agenda-list">
            {selectedEvents.map(event=><div className={`cal-agenda-item${event.completed_at?" completed":""}`} key={event.id}><span className="cal-agenda-rail event" /><div className="cal-agenda-content"><span className="cal-agenda-time"><Clock3 />{timeOf(event.start_at)} – {timeOf(event.end_at)}</span><b>{event.title}</b>{event.description&&<p>{event.description}</p>}</div><div className="cal-agenda-actions"><button className={event.completed_at?"iconbtn cal-undo":"iconbtn cal-done"} aria-label={(event.completed_at?"Undo completion for ":"Mark completed ")+event.title} disabled={updateEvent.isPending} onClick={()=>updateEvent.mutate({id:event.id,completed:!event.completed_at},{onSuccess:()=>{if(!event.completed_at)confetti();}})}>{event.completed_at?<RotateCcw className="ic"/>:<CircleCheckBig className="ic"/>}</button><button className="iconbtn cal-delete" aria-label={"Delete "+event.title} onClick={()=>remove.mutate(event.id)}><Trash2 className="ic" /></button></div></div>)}
            {selectedTasks.map(task=><div className="cal-agenda-item" key={task.id}><span className="cal-agenda-rail deadline" /><div className="cal-agenda-content"><span className="cal-agenda-time"><ListTodo />Task deadline</span><b>{task.title}</b></div></div>)}
          </div>}
          <button className="cal-agenda-add" onClick={showNew}><Plus />Add an event to this day</button>
        </Card>
        <Card className="cal-next-card"><div className="cal-side-head"><div><h3>Next 7 days</h3></div><ArrowUpRight className="cal-side-arrow" /></div>{Array.from({length:7},(_,i)=>addDays(new Date(selected+"T12:00:00"),i)).map(date=>{const key=isoDate(date),count=itemCount(key);return <button type="button" key={key} className={"cal-upcoming-row"+(key===selected?" active":"")} onClick={()=>chooseDate(date)}><span><b>{labelDate(date,{weekday:"short"})}</b><small>{labelDate(date,{day:"numeric",month:"short"})}</small></span><i>{count||"—"}</i></button>})}</Card>
      </aside>
    </div>
    {isNew&&<FormModal title="New event" busy={create.isPending} onClose={closeNew} initial={{date:selected,start:"10:00",end:"11:00"}} fields={[{name:"title",label:"Title",required:true},{name:"description",label:"Details",type:"textarea"},{name:"date",label:"Date",type:"date",required:true},{name:"start",label:"Starts",type:"time",half:true,required:true},{name:"end",label:"Ends",type:"time",half:true,required:true}]} onSubmit={v=>{try{const start_at=new Date(v.date+"T"+v.start).toISOString(),end_at=new Date(v.date+"T"+v.end).toISOString();if(new Date(end_at)<=new Date(start_at))throw new Error("The end time must be after the start time.");create.mutate({title:v.title.trim(),description:v.description,start_at,end_at},{onSuccess:closeNew});}catch(error){toast(error instanceof Error?error.message:"Please check the event date and time.","error");}}}/>}
  </>;
}
