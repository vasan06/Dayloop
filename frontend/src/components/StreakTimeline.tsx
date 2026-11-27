type Event = { habit_id: string | null; event_type: string; event_date: string };
type Habit = { habit_id: string; name: string };
type Status = "Continued" | "Failed" | "Missed";
type Range = { status: Status; start: string; end: string; count: number };
const statusOf = (s: string): Status | undefined =>
  ["started","continued","resumed","completed"].includes(s) ? "Continued" : s === "failed" ? "Failed" : s === "missed" ? "Missed" : undefined;
const nextDay = (day: string) => new Date(Date.parse(day+"T00:00:00Z")+86400000).toISOString().slice(0,10);
const format = (day: string) => new Date(day+"T00:00:00Z").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
export function groupStreakDates(events: Event[]): Range[] {
  const ranges: Range[] = [];
  const sorted = [...events].sort((a,b)=>a.event_date.localeCompare(b.event_date));
  for (const e of sorted) {
    const status = statusOf(e.event_type), day = e.event_date.slice(0,10);
    if (!status || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day))) continue;
    const last = ranges[ranges.length-1];
    if (last?.status === status && last.end === day) continue;
    if (last?.status === status && nextDay(last.end) === day) { last.end=day; last.count++; }
    else ranges.push({status,start:day,end:day,count:1});
  }
  return ranges.reverse();
}
export default function StreakTimeline({events,habits}:{events:Event[];habits:Habit[]}) {
  const groups = habits.map(h=>({...h,ranges:groupStreakDates(events.filter(e=>e.habit_id===h.habit_id))})).filter(h=>h.ranges.length);
  return <section className="streak-timeline"><b>Streak timeline</b>
    {!groups.length && <small className="mute">No recorded streak ranges available.</small>}
    {groups.map(h=><div key={h.habit_id} className="streak-range-group">
      <b className="streak-range-name">{h.name}</b>
      {h.ranges.map((r,i)=><div className={`streak-event streak-range ${r.status.toLowerCase()}`} key={r.start+"-"+i}>
        <i/><div><b>{r.status}</b><small>{format(r.start)}{r.start!==r.end?" – "+format(r.end):""} · {r.count} {r.count===1?"day":"days"}</small></div>
      </div>)}
    </div>)}
  </section>;
}
