import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Trash2, ArrowUpRight, CalendarCheck2, ListTodo } from "lucide-react";
import { Card, Empty, ErrorBox, FormModal, PageHead, Skeleton } from "../components/ui";
import { useCreateEvent, useDeleteEvent, useEvents, useTasks } from "../hooks/data";
import { useNewParam } from "../hooks/useNewParam";
import { dayKey, isoDate, shortDate, timeOf } from "../lib/format";
import { toast } from "../lib/toast";

type CalendarView = "month" | "week" | "day";
type DayItems = { events: NonNullable<ReturnType<typeof useEvents>["data"]>; tasks: NonNullable<ReturnType<typeof useTasks>["data"]> };

const toIso = (date: string, input: string) => {
  const match = input.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) {
    const parsed = new Date(date + "T" + input + ":00");
    if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid time.");
    return parsed.toISOString();
  }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour < 1 || hour > 12) throw new Error("Enter a valid time.");
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  const parsed = new Date(date + "T" + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + ":00");
  if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid date and time.");
  return parsed.toISOString();
};
const addDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
const startOfWeek = (date: Date) => { const next = new Date(date); next.setHours(0,0,0,0); next.setDate(next.getDate() - ((next.getDay()+6)%7)); return next; };
const labelDate = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en", options);
const hourLabel = (hour: number) => new Date(2000,0,1,hour).toLocaleTimeString("en",{hour:"numeric",hour12:true});
const isOpenTask = (task: {status:string;due_at:string|null}) => Boolean(task.due_at && task.status !== "completed" && task.status !== "cancelled");

export default function Calendar() {
  const events = useEvents();
  const tasks = useTasks();
  const create = useCreateEvent();
  const remove = useDeleteEvent();
  const [isNew, closeNew, showNew] = useNewParam();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(isoDate());
  const [view, setView] = useState<CalendarView>("month");

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

  const monthStart = new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const monthDays = Array.from({length:42},(_,i)=>addDays(startOfWeek(monthStart),i));
  const weekStart = startOfWeek(new Date(selected+"T12:00:00"));
  const weekDays = Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const selectedDate = new Date(selected+"T12:00:00");
  const selectedItems = byDay.get(selected) ?? {events:[],tasks:[]};
  const selectedEvents = [...selectedItems.events].sort((a,b)=>a.start_at.localeCompare(b.start_at));
  const selectedTasks = [...selectedItems.tasks].sort((a,b)=>(a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const itemCount = (key:string) => { const value=byDay.get(key); return (value?.events.length ?? 0)+(value?.tasks.length ?? 0); };
  const totalEvents = events.data?.length ?? 0;
  const openDeadlines = (tasks.data ?? []).filter(isOpenTask).length;

  const shift = (direction:number) => {
    if(view === "day") {
      const next=addDays(selectedDate,direction); setSelected(isoDate(next)); setCursor(next);
    } else if(view === "week") {
      const next=addDays(weekStart,direction*7); setSelected(isoDate(next)); setCursor(next);
    } else setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+direction,1));
  };
  const goToday = () => { const today=new Date(); setCursor(today); setSelected(isoDate(today)); };
  const heading = view === "day"
    ? labelDate(selectedDate,{weekday:"long",day:"numeric",month:"long",year:"numeric"})
    : view === "week"
      ? labelDate(weekStart,{day:"numeric",month:"short"})+" – "+labelDate(addDays(weekStart,6),{day:"numeric",month:"short",year:"numeric"})
      : labelDate(cursor,{month:"long",year:"numeric"});

  const chooseDate = (date:Date) => { setSelected(isoDate(date)); setCursor(date); };
  const dayCell = (date:Date) => {
    const key=isoDate(date), count=itemCount(key), data=byDay.get(key);
    const isToday=key===isoDate(), isSelected=key===selected;
    return <button type="button" key={key} className={"cal-month-day"+(isSelected?" selected":"")+(isToday?" today":"")+(date.getMonth()!==cursor.getMonth()?" outside":"")} onClick={()=>chooseDate(date)} aria-pressed={isSelected} aria-label={labelDate(date,{weekday:"long",month:"long",day:"numeric"})+", "+count+" scheduled items"}>
      <span className="cal-date-number">{date.getDate()}</span>
      <span className="cal-day-meta">{count ? count+" item"+(count===1?"":"s") : " "}</span>
      <span className="cal-day-dots">{(data?.events.length ?? 0)>0 && <i className="event" />}{(data?.tasks.length ?? 0)>0 && <i className="deadline" />}{count>2 && <small>+{count-2}</small>}</span>
      <span className="cal-day-preview">{(data?.events ?? []).slice(0,1).map(event=><span className="cal-event-preview" key={event.id}>{event.title}</span>)}{(data?.tasks ?? []).slice(0,1).map(task=><span className="cal-task-preview" key={task.id}>{task.title}</span>)}</span>
    </button>;
  };

  const dayEvents = selectedEvents;
  const outsideHours = dayEvents.filter(event => { const hour=new Date(event.start_at).getHours(); return hour<7 || hour>21; });

  return <>
    <PageHead title="Calendar" sub="Your time, commitments and deadlines in one clear view">
      <button className="btn pri" onClick={showNew}><Plus className="ic" />New event</button>
    </PageHead>
    <div className="cal-overview">
      <div className="cal-overview-item"><span className="cal-overview-icon"><CalendarDays /></span><span><small>EVENTS</small><b>{totalEvents}</b></span></div>
      <div className="cal-overview-item"><span className="cal-overview-icon deadline"><ListTodo /></span><span><small>OPEN DEADLINES</small><b>{openDeadlines}</b></span></div>
      <div className="cal-overview-item"><span className="cal-overview-icon today"><CalendarCheck2 /></span><span><small>ON SELECTED DAY</small><b>{itemCount(selected)}</b></span></div>
    </div>
    <div className="cal-layout">
      <Card className="cal-calendar-card">
        <div className="cal-calendar-head">
          <div className="cal-heading-group"><span className="cal-heading-icon"><CalendarDays /></span><div><span className="cal-eyebrow">{view==="month"?"YOUR MONTH":view==="week"?"YOUR WEEK":"YOUR DAY"}</span><h2>{heading}</h2><small>{events.isLoading||tasks.isLoading?"Updating your schedule…":view==="month"?"A little structure goes a long way.":view==="week"?"A closer look at the week ahead.":"Your schedule, hour by hour."}</small></div></div>
          <div className="cal-toolbar-actions">
            <div className="cal-view-switch" role="group" aria-label="Calendar view">
              {(["month","week","day"] as const).map(item=><button type="button" key={item} className={view===item?"active":""} aria-pressed={view===item} onClick={()=>setView(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}
            </div>
            <div className="cal-period-actions"><button className="btn sm" onClick={goToday}>Today</button><button className="iconbtn" aria-label="Previous period" onClick={()=>shift(-1)}><ChevronLeft className="ic" /></button><button className="iconbtn" aria-label="Next period" onClick={()=>shift(1)}><ChevronRight className="ic" /></button></div>
          </div>
        </div>
        {events.isError ? <ErrorBox error={events.error} retry={()=>void events.refetch()} /> : tasks.isError ? <ErrorBox error={tasks.error} retry={()=>void tasks.refetch()} /> : events.isLoading||tasks.isLoading ? <Skeleton rows={5} /> : <>
          {view==="month" && <div className="cal-month-view"><div className="cal-weekday-row">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><span key={day}>{day}</span>)}</div><div className="cal-month-grid">{monthDays.map(dayCell)}</div></div>}
          {view==="week" && <div className="cal-week-view">{weekDays.map(date=>{const key=isoDate(date),data=byDay.get(key),count=itemCount(key);return <button type="button" key={key} className={"cal-week-day"+(key===selected?" selected":"")+(key===isoDate()?" today":"")} onClick={()=>chooseDate(date)}><span className="cal-week-dayname">{labelDate(date,{weekday:"short"})}</span><strong>{date.getDate()}</strong><small>{count?count+" items":"Clear"}</small><span className="cal-week-events">{(data?.events??[]).slice(0,3).map(event=><i key={event.id}>{timeOf(event.start_at)} · {event.title}</i>)}{(data?.tasks??[]).slice(0,2).map(task=><i className="deadline" key={task.id}>{task.title}</i>)}</span><span className="cal-week-dots">{(data?.events.length??0)>0&&<i/>}{(data?.tasks.length??0)>0&&<i className="deadline"/>}</span></button>})}</div>}
          {view==="day" && <div className="cal-day-view"><div className="cal-day-banner"><div><span className="cal-eyebrow">SELECTED DAY</span><h3>{labelDate(selectedDate,{weekday:"long",day:"numeric",month:"long"})}</h3></div><span className="cal-day-count">{dayEvents.length} event{dayEvents.length===1?"":"s"}</span></div><div className="cal-timeline">{Array.from({length:15},(_,i)=>i+7).map(hour=>{const hourEvents=dayEvents.filter(event=>new Date(event.start_at).getHours()===hour);return <div className="cal-time-row" key={hour}><span className="cal-time-label">{hourLabel(hour)}</span><div className="cal-time-slot">{hourEvents.length?hourEvents.map(event=><div className="cal-timeline-event" key={event.id}><b>{event.title}</b><small>{timeOf(event.start_at)} – {timeOf(event.end_at)}</small>{event.description&&<p>{event.description}</p>}</div>):<span className="cal-time-empty" />}</div></div>})}</div>{outsideHours.length>0&&<div className="cal-outside-hours"><b>Outside the timeline</b>{outsideHours.map(event=><span key={event.id}>{timeOf(event.start_at)} · {event.title}</span>)}</div>}</div>}
        </>}
        <div className="cal-legend"><span><i className="event" />Events</span><span><i className="deadline" />Task deadlines</span><span className="cal-legend-hint">Select a date to inspect its agenda</span></div>
      </Card>
      <aside className="cal-side">
        <Card className="cal-agenda-card">
          <div className="cal-side-head"><div><span className="cal-eyebrow">YOUR SCHEDULE</span><h3>Day agenda</h3><small>{shortDate(selected+"T12:00:00")}</small></div></div>
          <div className="cal-agenda-totals"><b>{selectedEvents.length+selectedTasks.length}</b><span><strong>planned items</strong><small>{selectedEvents.length} events · {selectedTasks.length} deadlines</small></span></div>
          {selectedEvents.length===0&&selectedTasks.length===0 ? <Empty title="A little breathing room" hint="Nothing is scheduled for this day. Add an event below or keep the time free." /> : <div className="cal-agenda-list">
            {selectedEvents.map(event=><div className="cal-agenda-item" key={event.id}><span className="cal-agenda-rail event" /><div className="cal-agenda-content"><span className="cal-agenda-time"><Clock3 />{timeOf(event.start_at)} – {timeOf(event.end_at)}</span><b>{event.title}</b>{event.description&&<p>{event.description}</p>}</div><button className="iconbtn cal-delete" aria-label={"Delete "+event.title} onClick={()=>remove.mutate(event.id)}><Trash2 className="ic" /></button></div>)}
            {selectedTasks.map(task=><div className="cal-agenda-item" key={task.id}><span className="cal-agenda-rail deadline" /><div className="cal-agenda-content"><span className="cal-agenda-time"><ListTodo />Task deadline</span><b>{task.title}</b></div></div>)}
          </div>}
          <button className="cal-agenda-add" onClick={showNew}><Plus />Add an event to this day</button>
        </Card>
        <Card className="cal-next-card"><div className="cal-side-head"><div><span className="cal-eyebrow">COMING UP</span><h3>Next 7 days</h3></div><ArrowUpRight className="cal-side-arrow" /></div>{Array.from({length:7},(_,i)=>addDays(new Date(selected+"T12:00:00"),i)).map(date=>{const key=isoDate(date),count=itemCount(key);return <button type="button" key={key} className={"cal-upcoming-row"+(key===selected?" active":"")} onClick={()=>chooseDate(date)}><span><b>{labelDate(date,{weekday:"short"})}</b><small>{labelDate(date,{day:"numeric",month:"short"})}</small></span><i>{count||"—"}</i></button>})}</Card>
      </aside>
    </div>
    {isNew&&<FormModal title="New event" busy={create.isPending} onClose={closeNew} initial={{date:selected,start:"10:00 AM",end:"11:00 AM"}} fields={[{name:"title",label:"Title",required:true},{name:"description",label:"Details",type:"textarea"},{name:"date",label:"Date",type:"date",required:true},{name:"start",label:"Starts",type:"text",placeholder:"10:00 AM",half:true,required:true},{name:"end",label:"Ends",type:"text",placeholder:"11:00 AM",half:true,required:true}]} onSubmit={v=>{try{const start_at=toIso(v.date,v.start),end_at=toIso(v.date,v.end);if(new Date(end_at)<=new Date(start_at))throw new Error("The end time must be after the start time.");create.mutate({title:v.title.trim(),description:v.description,start_at,end_at},{onSuccess:closeNew});}catch(error){toast(error instanceof Error?error.message:"Please check the event date and time.","error");}}}/>}
  </>;
}
