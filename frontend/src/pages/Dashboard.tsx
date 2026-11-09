import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Flame, Sparkles } from "lucide-react";
import { Card, CardHead, Check22, Empty, Seg, Skeleton, confetti, useCountUp } from "../components/ui";
import { Bars, Donut, Gauge, Heatmap, LineChart, Progress, Rings, Spark } from "../components/charts";
import { PALETTE, isOpen, isOverdue, isToday, projectProgress, spendingByCategory } from "../lib/derive";
import { useCategories, useEvents, useHabits, useInsights, useProfile, useProjects, useSummary, useTasks, useTransactions, useUpdateTask } from "../hooks/data";
import { addDays, greeting, isoDate, money, num, shortDate, timeOf, toneOf } from "../lib/format";

function Count({ value, money: asMoney }: { value: number; money?: boolean }) {
  const v = useCountUp(value);
  return <>{asMoney ? money(v) : Math.round(v)}</>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState<"7" | "30">("7");
  const profile = useProfile();
  const tasks = useTasks();
  const projects = useProjects();
  const habits = useHabits();
  const summary = useSummary();
  const txs = useTransactions();
  const cats = useCategories();
  const events = useEvents();
  const insights = useInsights(35);
  const update = useUpdateTask();

  const t = tasks.data ?? [];
  const h = habits.data ?? [];
  const open = t.filter(isOpen);
  const today = open.filter(isToday);
  const overdue = open.filter(isOverdue);
  const doneToday = t.filter((x) => x.completed_at && isoDate(new Date(x.completed_at)) === isoDate()).length;
  const dueTodayTotal = today.length + doneToday;
  const habitsDone = h.filter((x) => x.completed_today).length;
  const series = insights.data?.series ?? [];
  const windowed = series.slice(-Number(range));
  const labels = windowed.map((d) => new Date(d.day + "T00:00").toLocaleDateString("en", { day: "numeric", month: range === "7" ? undefined : "short", weekday: range === "7" ? "short" : undefined }));
  const week = series.slice(-7);
  const gauge = dueTodayTotal ? (doneToday / dueTodayTotal) * 100 : open.length ? 0 : 100;
  const net = num(summary.data?.net);
  const progress = useMemo(() => projectProgress(t), [t]);
  const spend = spendingByCategory(txs.data ?? [], cats.data ?? []).slice(0, 5);
  const spendTotal = spend.reduce((a, s) => a + s.value, 0);
  const todayEvents = (events.data ?? []).filter((e) => new Date(e.end_at) >= new Date()).slice(0, 4);
  const best = overdue[0] ?? today[0] ?? open.find((x) => x.priority === "high" || x.priority === "urgent") ?? open[0];
  const name = (profile.data?.display_name || "there").split(" ")[0];

  const heat = useMemo(() => {
    const total = Math.max(1, h.length);
    const days = series.slice(-35);
    return { cells: days.map((d) => { const r = d.habits_done / total; return d.habits_done === 0 ? 0 : r > 0.99 ? 4 : r > 0.66 ? 3 : r > 0.33 ? 2 : 1; }), first: days[0] ? new Date(days[0].day + "T00:00").getDay() : 1, tips: days.map((d) => `${shortDate(d.day + "T00:00")}\n${d.habits_done} habit${d.habits_done === 1 ? "" : "s"} done`) };
  }, [series, h.length]);

  const loading = tasks.isLoading || habits.isLoading || insights.isLoading;
  const toggle = (id: string, done: boolean, el: HTMLElement) => { update.mutate({ id, status: done ? "not_started" : "completed" }); if (!done) confetti(el); };

  return (
    <div className="g">
      <section className="hero s12" style={{ "--i": 0 } as React.CSSProperties}>
        <svg className="bg" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="720" cy="40" r="170" fill="var(--acc)" opacity=".35" /><circle cx="90" cy="300" r="130" fill="var(--violet)" opacity=".18" /></svg>
        <div>
          <div className="mono">{new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}</div>
          <div className="hh">{greeting()}, {name}.<br />{dueTodayTotal ? <>{today.length} left <em>today</em></> : <>A clear <em>day</em> ahead</>}</div>
          <p>{overdue.length ? `${overdue.length} overdue task${overdue.length > 1 ? "s" : ""} need attention.` : "You're on top of things."} {h.length ? `${habitsDone}/${h.length} habits checked in.` : "Add a habit to start a streak."}</p>
          <div className="row wrap">
            <button className="btn acc" onClick={() => navigate("/tasks?new=1")}>Add a task<ArrowUpRight className="ic go" /></button>
            <button className="btn wh" onClick={() => navigate("/habits")}>Check in habits</button>
          </div>
        </div>
        <div className="glass rg">
          <Rings rings={[{ value: gauge, color: "var(--acc)", label: "Today's tasks" }, { value: h.length ? (habitsDone / h.length) * 100 : 0, color: "var(--amber)", label: "Habits" }, { value: week.length ? Math.min(100, (week.reduce((a, d) => a + d.tasks_completed, 0) / Math.max(1, week.reduce((a, d) => a + d.tasks_created, 0))) * 100) : 0, color: "var(--green)", label: "Week flow" }]} />
          <ul><li><i style={{ background: "var(--acc)" }} />Tasks</li><li><i style={{ background: "var(--amber)" }} />Habits</li><li><i style={{ background: "var(--green)" }} />Week</li></ul>
        </div>
      </section>

      <Card tone="acc" className="s4 nba" i={1}>
        <div className="mono"><Sparkles className="ic" style={{ display: "inline", width: 14, height: 14 }} /> Next best action</div>
        {best ? <><h3>{best.title}</h3><p style={{ margin: "0 0 14px", opacity: 0.85 }}>{isOverdue(best) ? "This one is overdue — clear it first." : best.due_at ? `Due ${shortDate(best.due_at)}.` : "Highest-impact open task."}</p><button className="btn pri sm" onClick={(e) => toggle(best.id, false, e.currentTarget)}>Mark done</button></> : <><h3>Nothing queued</h3><p style={{ margin: 0, opacity: 0.85 }}>Add a task and DayLoop will suggest what to do next.</p></>}
      </Card>

      {([
        { label: "Open tasks", v: open.length, tone: "butter", spark: week.map((d) => d.tasks_created), to: "/tasks" },
        { label: "Habit streak", v: Math.max(0, ...h.map((x) => x.current_streak)), tone: "mint", spark: week.map((d) => d.habits_done), to: "/habits", suffix: " d" },
        { label: "Net this month", v: net, tone: "sky", money: true, spark: week.map((d) => num(d.income) - num(d.expenses)), to: "/finance" },
        { label: "Overdue", v: overdue.length, tone: "blush", spark: week.map((d) => d.tasks_completed), to: "/tasks" },
      ] as const).map((s, i) => (
        <Card key={s.label} tone={s.tone} className="s2 stat" i={i + 2}>
          <Link to={s.to} className="lbl"><span className="mono">{s.label}</span><ArrowUpRight className="ic" style={{ width: 14, height: 14 }} /></Link>
          <div className="big" style={{ margin: "10px 0 6px", fontSize: "money" in s ? 22 : 30 }}>{loading ? "—" : <Count value={s.v} money={"money" in s} />}{"suffix" in s ? s.suffix : ""}</div>
          <Spark values={s.spark.length ? s.spark : [0, 0]} />
        </Card>
      ))}

      <Card className="s8" i={6}>
        <CardHead mono="Productivity" title="Tasks & habits completed" right={<Seg value={range} options={[["7", "7 days"], ["30", "30 days"]]} onChange={setRange} />} />
        {insights.isLoading ? <Skeleton rows={5} /> : <LineChart labels={labels} series={[{ name: "Tasks done", values: windowed.map((d) => d.tasks_completed), color: "var(--acc)" }, { name: "Habits done", values: windowed.map((d) => d.habits_done), color: "var(--amber)" }]} />}
      </Card>
      <Card className="s4" i={7}><CardHead mono="Today" title="Completion" /><Gauge value={gauge} label={`${doneToday} of ${dueTodayTotal} done`} /></Card>

      <Card className="s4" i={8}><CardHead mono="This week" title="Tasks completed" /><Bars labels={week.map((d) => new Date(d.day + "T00:00").toLocaleDateString("en", { weekday: "narrow" }))} values={week.map((d) => d.tasks_completed)} /></Card>
      <Card className="s4" i={9}><CardHead mono="Consistency" title="Habit activity" />{h.length ? <Heatmap cells={heat.cells} startWeekday={heat.first} tips={heat.tips} /> : <Empty title="No habits yet" hint="Build a streak." action={<button className="btn sm" onClick={() => navigate("/habits?new=1")}>Add habit</button>} />}</Card>
      <Card className="s4" i={10}>
        <CardHead mono="Projects" title="Progress" right={<Link className="lnk acc sm" to="/projects">All</Link>} />
        <div className="list">
          {(projects.data ?? []).filter((p) => p.status === "active").slice(0, 4).map((p) => { const pr = progress.get(p.id); const pct = pr?.total ? (pr.done / pr.total) * 100 : 0; return <div key={p.id} className="li" style={{ display: "block" }}><div className="row sb"><b>{p.name}</b><span className="mono">{Math.round(pct)}%</span></div><Progress value={pct} /></div>; })}
          {!(projects.data ?? []).length && <Empty title="No projects" hint="Group tasks into projects." />}
        </div>
      </Card>

      <Card className="s6" i={11}>
        <CardHead mono="Focus" title="Today & upcoming" right={<Link className="lnk acc sm" to="/tasks">View all</Link>} />
        {tasks.isLoading ? <Skeleton /> : <div className="list">{[...overdue, ...today, ...open.filter((x) => !isToday(x) && !isOverdue(x))].slice(0, 6).map((x, i) => (
          <div key={x.id} className="li" style={{ "--i": i } as React.CSSProperties}><Check22 on={false} label={`Complete ${x.title}`} onClick={() => update.mutate({ id: x.id, status: "completed" })} /><span className="t">{x.title}</span>{isOverdue(x) ? <span className="pill hi">Overdue</span> : x.due_at ? <span className="pill">{shortDate(x.due_at)}</span> : null}</div>
        ))}{!open.length && <Empty title="All clear" hint="No open tasks. Enjoy it — or plan the next one." />}</div>}
      </Card>
      <Card className="s6" i={12}>
        <CardHead mono="Spending" title="This month by category" right={<Link className="lnk acc sm" to="/finance">Finance</Link>} />
        {spend.length ? <div className="rg" style={{ justifyContent: "space-around", flexWrap: "wrap" }}><Donut size={160} slices={spend.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))} center={money(spendTotal)} sub="spent" /><ul>{spend.map((s, i) => <li key={s.label}><i style={{ background: PALETTE[i % PALETTE.length] }} />{s.label} <b className="num">{money(s.value)}</b></li>)}</ul></div> : <Empty title="No spending yet" hint="Log an expense to see the breakdown." action={<button className="btn sm" onClick={() => navigate("/finance?new=1")}>Add transaction</button>} />}
      </Card>

      <Card className="s6" i={13}>
        <CardHead mono="Schedule" title="Coming up" right={<Link className="lnk acc sm" to="/calendar">Calendar</Link>} />
        {todayEvents.length ? <div className="tl">{todayEvents.map((e) => <div className="ev" key={e.id}><b>{e.title}</b><div className="mono">{shortDate(e.start_at)} · {timeOf(e.start_at)}</div></div>)}</div> : <Empty title="Nothing scheduled" hint="Add an event to your calendar." action={<button className="btn sm" onClick={() => navigate("/calendar?new=1")}><CalendarDays className="ic" />Add event</button>} />}
      </Card>
      <Card className="s6" i={14}>
        <CardHead mono="Cash flow" title="Income vs expenses" />
        {series.length ? <LineChart height={190} labels={series.slice(-14).map((d) => shortDate(d.day + "T00:00"))} format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} series={[{ name: "Income", values: series.slice(-14).map((d) => num(d.income)), color: "var(--green)" }, { name: "Expenses", values: series.slice(-14).map((d) => num(d.expenses)), color: "var(--rose)" }]} /> : <Skeleton />}
        <div className="row sb sm mute" style={{ marginTop: 8 }}><span><Flame className="ic" style={{ display: "inline", width: 13, height: 13 }} /> Month: {money(summary.data?.income)} in</span><span>{money(summary.data?.expenses)} out</span></div>
      </Card>
      <p className="mute sm s12" style={{ margin: 0 }}>{addDays(new Date(), 0).getFullYear()} · All figures are live from your DayLoop workspace.</p>
    </div>
  );
}
