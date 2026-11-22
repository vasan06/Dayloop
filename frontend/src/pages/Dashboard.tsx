import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Flame, Sparkles } from "lucide-react";
import { Card, CardHead, Check22, Empty, Seg, Skeleton, confetti, useCountUp } from "../components/ui";
import { Bars, Donut, Gauge, Heatmap, LineChart, Progress, Rings, Spark } from "../components/charts";
import { includesRecord, largestTransaction, PALETTE, isOpen, isOverdue, isToday, projectProgress, spendingByCategory } from "../lib/derive";
import { useEvents, useHabits, useInsights, useProfile, useProjects, useSummary, useTasks, useTransactions, useUpdateTask } from "../hooks/data";
import { addDays, compact, greeting, isoDate, money, num, shortDate, timeOf } from "../lib/format";
import { toast } from "../lib/toast";

function Count({ value, money: asMoney }: { value: number; money?: boolean }) {
  const v = useCountUp(value);
  return <>{asMoney ? money(v) : Math.round(v)}</>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState<"7" | "30">("7");
  const [weekMetric, setWeekMetric] = useState<"tasks_completed" | "habits_done" | "expenses">("tasks_completed");
  const [heatMonthOffset, setHeatMonthOffset] = useState(0);
  const heatMonth = new Date(new Date().getFullYear(), new Date().getMonth() - heatMonthOffset, 1);
  const heatDays = new Date(heatMonth.getFullYear(), heatMonth.getMonth() + 1, 0).getDate();
  const insightDays = Math.min(365, Math.max(35, Math.round((Date.now() - heatMonth.getTime()) / 86_400_000) + 1));
  const profile = useProfile();
  const tasks = useTasks();
  const projects = useProjects();
  const habits = useHabits();
  const summary = useSummary();
  const txs = useTransactions();
  const events = useEvents();
  const insights = useInsights(insightDays);
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
  const previousWeek = series.slice(-14, -7);
  const fourWeeksEarlier = series.slice(-35, -28);
  const periodTotal = (days: typeof series, key: "tasks_completed" | "tasks_created" | "habits_done" | "income" | "expenses") =>
    days.reduce((total, day) => total + num(day[key]), 0);
  const percentChange = (current: number, previous: number, hasPrevious: boolean) => {
    if (!hasPrevious) return "—";
    if (previous === 0) return current > 0 ? "New" : "—";
    const change = Math.round(((current - previous) / previous) * 100);
    return `${change > 0 ? "+" : ""}${change}%`;
  };
  const comparisons = [
    { name: "Tasks completed", key: "tasks_completed" as const, format: (value: number) => String(Math.round(value)) },
    { name: "Habit check-ins", key: "habits_done" as const, format: (value: number) => String(Math.round(value)) },
    { name: "Income", key: "income" as const, format: (value: number) => money(value) },
    { name: "Expenses", key: "expenses" as const, format: (value: number) => money(value) },
  ].map((metric) => {
    const current = periodTotal(week, metric.key);
    const previous = periodTotal(previousWeek, metric.key);
    const earlier = periodTotal(fourWeeksEarlier, metric.key);
    return {
      name: metric.name,
      current: metric.format(current),
      previous: previousWeek.length === 7 ? metric.format(previous) : "—",
      earlier: fourWeeksEarlier.length === 7 ? metric.format(earlier) : "—",
      spark: [
        ...(fourWeeksEarlier.length === 7 ? [{ label: "4 weeks earlier", value: earlier }] : []),
        ...(previousWeek.length === 7 ? [{ label: "Previous 7 days", value: previous }] : []),
        ...(week.length ? [{ label: "Last 7 days", value: current }] : []),
      ],
      format: metric.format,
      change: percentChange(current, previous, previousWeek.length === 7),
    };
  });
  const gauge = dueTodayTotal ? (doneToday / dueTodayTotal) * 100 : 0;
  const weekDone = periodTotal(week, "tasks_completed");
  const weekCreated = periodTotal(week, "tasks_created");
  const net = num(summary.data?.net);
  const progress = useMemo(() => projectProgress(t), [t]);
  const spend = spendingByCategory(summary.data, 5);
  const spendTotal = spend.reduce((a, s) => a + s.value, 0);
  const todayEvents = (events.data ?? []).filter((e) => new Date(e.end_at) >= new Date()).slice(0, 4);
  const best = overdue[0] ?? today[0] ?? open.find((x) => x.priority === "high" || x.priority === "urgent") ?? open[0];
  const name = (profile.data?.username || profile.data?.display_name || "there").split(" ")[0];

  const heat = useMemo(() => {
    const total = Math.max(1, h.length);
    const byDay = new Map(series.map((day) => [day.day, day]));
    const days = Array.from({ length: heatDays }, (_, index) => {
      const date = new Date(heatMonth.getFullYear(), heatMonth.getMonth(), index + 1);
      const key = isoDate(date);
      return byDay.get(key) ?? { day: key, habits_done: 0 };
    });
    return { cells: days.map((d) => { const r = d.habits_done / total; return d.habits_done === 0 ? 0 : r > 0.99 ? 4 : r > 0.66 ? 3 : r > 0.33 ? 2 : 1; }), first: days[0] ? new Date(days[0].day + "T00:00").getDay() : 1, tips: days.map((d) => `${shortDate(d.day + "T00:00")}\n${d.habits_done} habit${d.habits_done === 1 ? "" : "s"} done`), values: days.map((d) => d.habits_done) };
  }, [series, h.length, heatMonthOffset]);

  const loading = tasks.isLoading || habits.isLoading || insights.isLoading;
  const toggle = (id: string, done: boolean, el: HTMLElement) => { update.mutate({ id, status: done ? "not_started" : "completed" }, { onSuccess: () => { if (!done) confetti(el); } }); };

  return (
    <div className="g dashboard-page">
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
          <Rings rings={[
            { value: gauge, color: "var(--acc)", label: "Tasks", detail: `${doneToday} of ${dueTodayTotal} tasks done today.` },
            { value: h.length ? habitsDone / h.length * 100 : 0, color: "var(--amber)", label: "Habits", detail: `${habitsDone} of ${h.length} habits completed today.` },
            { value: weekCreated ? Math.min(100, weekDone / weekCreated * 100) : 0, color: "var(--green)", label: "Week flow", detail: `${weekDone} tasks completed and ${weekCreated} created in the last seven days.` },
          ]} />
        </div>
      </section>

      <Card className="s4 completion-card task-completion" i={1}>
        <CardHead mono="TODAY · TASKS" title="Task completion" />
        <Gauge value={gauge} label={`${doneToday} of ${dueTodayTotal || 0} tasks done`} />
      </Card>
      <Card className="s4 completion-card habit-completion" i={2}>
        <CardHead mono="TODAY · HABITS" title="Habit completion" />
        <Gauge value={h.length ? (habitsDone / h.length) * 100 : 0} label={`${habitsDone} of ${h.length} habits done`} />
      </Card>

      <Card tone="acc" className="s4 nba" i={3}>
        <div className="mono"><Sparkles className="ic" style={{ display: "inline", width: 14, height: 14 }} /> Next best action</div>
        {best ? (
          <>
            <h3>{best.title}</h3>
            <p style={{ margin: "0 0 14px", opacity: 0.85 }}>
              {isOverdue(best) ? "This one is overdue — clear it first." : best.due_at ? `Due ${shortDate(best.due_at)}.` : "Highest-impact open task."}
            </p>
            <div className="row wrap" style={{ gap: 8 }}>
              <button
                className="btn sm"
                style={{ background: "var(--acc-ink)", color: "var(--acc)", boxShadow: "none" }}
                onClick={() => {
                  update.mutate({ id: best.id, status: "in_progress" });
                  toast("Started: " + best.title);
                }}
              >
                {best.status === "in_progress" ? "In progress" : "Start now"}
              </button>
              <button className="btn pri sm" onClick={(e) => toggle(best.id, false, e.currentTarget)}>
                Mark done
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>Nothing queued</h3>
            <p style={{ margin: 0, opacity: 0.85 }}>Add a task and DayLoop will suggest what to do next.</p>
          </>
        )}
      </Card>

      {([
        { label: "Open tasks", seriesName: "Tasks created", v: open.length, tone: "butter", spark: week.map((d) => d.tasks_created), to: "/tasks" },
        { label: "Habit streak", seriesName: "Habit check-ins", v: Math.max(0, ...h.map((x) => x.current_streak)), tone: "mint", spark: week.map((d) => d.habits_done), to: "/habits", suffix: " d" },
        { label: "Net this month", seriesName: "Daily net cash", v: net, tone: "sky", money: true, spark: week.map((d) => num(d.income) - num(d.expenses)), to: "/finance" },
        { label: "Overdue", v: overdue.length, tone: "blush", to: "/tasks" },
      ] as const).map((s, i) => (
        <Card key={s.label} tone={s.tone} className="s3 stat" i={i + 2}>
          <Link to={s.to} className="lbl"><span className="mono">{s.label}</span><ArrowUpRight className="ic" style={{ width: 14, height: 14 }} /></Link>
          <div className="big" style={{ margin: "10px 0 6px", fontSize: "money" in s ? 22 : 30 }}>{loading ? "—" : <Count value={s.v} money={"money" in s} />}{"suffix" in s ? s.suffix : ""}</div>
          {"spark" in s && s.spark.length > 0 && <><span className="sm mute">{s.seriesName} · last 7 days</span><Spark name={s.seriesName} labels={week.map(d => shortDate(d.day))} values={s.spark}
            format={"money" in s ? money : undefined}
            details={"money" in s ? week.map(d => `${money(d.income)} income less ${money(d.expenses)} expenses.`) : undefined} /></>}
          {!("spark" in s) && <span className="sm mute">{overdue.length ? `Oldest due ${shortDate(overdue.reduce((a, b) => (a.due_at || "") < (b.due_at || "") ? a : b).due_at)}` : "All tasks on time"}</span>}
        </Card>
      ))}

      <Card className="s8" i={6}>
        <CardHead mono="Productivity" title="Tasks & habits completed" right={<Seg value={range} options={[["7", "7 days"], ["30", "30 days"]]} onChange={setRange} />} />
        {insights.isLoading ? <Skeleton rows={5} /> : <LineChart labels={labels} series={[{ name: "Tasks done", values: windowed.map((d) => d.tasks_completed), details: windowed.map(d => includesRecord(d.completed_task)), color: "var(--acc)" }, { name: "Habits done", values: windowed.map((d) => d.habits_done), details: windowed.map(d => includesRecord(d.completed_habit)), color: "var(--amber)" }]} />}
      </Card>
      <Card className="s4 dashboard-week-chart-card" i={8}><CardHead mono="This week" title="This Week" right={<select aria-label="Weekly chart metric" value={weekMetric} onChange={(event) => setWeekMetric(event.target.value as typeof weekMetric)}><option value="tasks_completed">Tasks done</option><option value="habits_done">Habits done</option><option value="expenses">Expenses</option></select>} />{week.length ? <Bars height={260} xLabel="Day" yLabel={weekMetric === "tasks_completed" ? "Tasks" : weekMetric === "habits_done" ? "Habits" : "Expenses"} labels={week.map((d) => shortDate(d.day))} values={week.map((d) => num(d[weekMetric]))} details={weekMetric === "tasks_completed" ? week.map(d => includesRecord(d.completed_task)) : undefined} /> : <Empty title="No weekly data yet" hint="Add activity to see your weekly progress." />}</Card>
      <Card className="s6 dashboard-compact-card dashboard-heat-card" i={9}><CardHead mono="Consistency" title="Habit activity" right={<div className="row" style={{ gap: 8 }}><button className="btn sm" onClick={() => setHeatMonthOffset((value) => Math.min(11, value + 1))} disabled={heatMonthOffset >= 11} aria-label="Previous month">‹</button><span className="sm">{heatMonth.toLocaleDateString("en", { month: "long", year: "numeric" })}</span><button className="btn sm" onClick={() => setHeatMonthOffset((value) => Math.max(0, value - 1))} disabled={heatMonthOffset === 0} aria-label="Next month">›</button></div>} />{h.length ? <div className="dashboard-heat-wrap"><Heatmap cells={heat.cells} startWeekday={heat.first} tips={heat.tips} values={heat.values} /></div> : <Empty title="No habits yet" hint="Build a streak." action={<button className="btn sm" onClick={() => navigate("/habits?new=1")}>Add habit</button>} />}</Card>
      <Card className="s6 dashboard-compact-card" i={10}>
        <CardHead mono="Projects" title="Progress" right={<Link className="lnk acc sm" to="/projects">All</Link>} />
        <div className="list">
          {(projects.data ?? []).filter((p) => p.status === "active").slice(0, 4).map((p) => { const pr = progress.get(p.id); const pct = pr?.total ? (pr.done / pr.total) * 100 : 0; return <div key={p.id} className="li" style={{ display: "block" }}><div className="row sb"><b>{p.name}</b><span className="mono">{Math.round(pct)}%</span></div><Progress value={pct} label={p.name} detail={`${pr?.done ?? 0} of ${pr?.total ?? 0} project tasks completed.`} /></div>; })}
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
        {spend.length ? <Donut size={160} slices={spend.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))} center={money(spendTotal)} sub="spent" /> : <Empty title="No spending yet" hint="Log an expense to see the breakdown." action={<button className="btn sm" onClick={() => navigate("/finance?new=1")}>Add transaction</button>} />}
      </Card>

      <Card className="s6" i={13}>
        <CardHead mono="Schedule" title="Coming up" right={<Link className="lnk acc sm" to="/calendar">Calendar</Link>} />
        {todayEvents.length ? <div className="tl">{todayEvents.map((e) => <div className="ev" key={e.id}><b>{e.title}</b><div className="mono">{shortDate(e.start_at)} · {timeOf(e.start_at)}</div></div>)}</div> : <Empty title="Nothing scheduled" hint="Add an event to your calendar." action={<button className="btn sm" onClick={() => navigate("/calendar?new=1")}><CalendarDays className="ic" />Add event</button>} />}
      </Card>
      <Card className="s6" i={14}>
        <CardHead mono="Cash flow" title="Income vs expenses" />
        {series.length ? <LineChart height={190} labels={series.slice(-14).map((d) => shortDate(d.day + "T00:00"))} format={money} axisFormat={compact} series={[{ name: "Income", values: series.slice(-14).map((d) => num(d.income)), details: series.slice(-14).map(d => largestTransaction(d, "income")), color: "var(--green)" }, { name: "Expenses", values: series.slice(-14).map((d) => num(d.expenses)), details: series.slice(-14).map(d => largestTransaction(d, "expense")), color: "var(--rose)" }]} /> : <Skeleton />}
        <div className="row sb sm mute" style={{ marginTop: 8 }}><span><Flame className="ic" style={{ display: "inline", width: 13, height: 13 }} /> Month: {money(summary.data?.income)} in</span><span>{money(summary.data?.expenses)} out</span></div>
      </Card>

      <Card className="s6" i={15}>
        <CardHead mono="History" title="Recent activity" />
        <div className="tl">
          {t.filter((x) => x.status === "completed").slice(0, 3).map((item) => (
            <div className="ev" key={item.id}>
              <b>Completed</b> <span className="mute">{item.title}</span>
              <div className="sm mute mono">{item.completed_at ? shortDate(item.completed_at) : "Recently"}</div>
            </div>
          ))}
          {(txs.data ?? []).slice(0, 2).map((item) => (
            <div className="ev" key={item.id}>
              <b>Logged transaction</b> <span className="mute">{item.description} ({money(item.amount, item.currency)})</span>
              <div className="sm mute mono">{shortDate(item.transaction_date + "T00:00")}</div>
            </div>
          ))}
          {!t.some((x) => x.status === "completed") && !(txs.data ?? []).length && (
            <div className="mute sm">No recent activity yet. As you complete tasks and log expenses, they appear here.</div>
          )}
        </div>
      </Card>

      <Card tone="mint" className="s6" i={16}>
        <CardHead mono="Guide" title="Get comfortable" />
        <div className="list">
          <div className="li">
            <span className="chk on" style={{ cursor: "default" }}><Check22 on={true} label="" onClick={() => {}} /></span>
            <span className="t">Open the command palette anywhere</span>
            <span className="kbd">⌘K</span>
          </div>
          <div className="li">
            <span className="chk on" style={{ cursor: "default" }}><Check22 on={true} label="" onClick={() => {}} /></span>
            <span className="t">Try dark / light appearance</span>
            <span className="kbd">Top bar</span>
          </div>
          <div className="li">
            <span className="chk on" style={{ cursor: "default" }}><Check22 on={true} label="" onClick={() => {}} /></span>
            <span className="t">Write your first thought or plan</span>
            <span className="kbd">Notes</span>
          </div>
        </div>
      </Card>

      <Card className="s12" i={17}>
        <CardHead mono="Review" title="Period comparison" right={<span className="sm mute">Rolling 7-day windows · live workspace data</span>} />
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Measure</th>
                <th>Last 7 days</th>
                <th>Previous 7 days</th>
                <th>4 weeks earlier</th>
                <th>Trend</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((r) => (
                <tr key={r.name}>
                  <td><b>{r.name}</b></td>
                  <td className="num">{r.current}</td>
                  <td className="num mute">{r.previous}</td>
                  <td className="num mute">{r.earlier}</td>
                  <td style={{ width: 120 }}><Spark name={r.name} labels={r.spark.map(p => p.label)} values={r.spark.map(p => p.value)} format={r.format} color="var(--acc)" /></td>
                  <td><span className="pill">{r.change}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mute sm s12" style={{ margin: 0 }}>{addDays(new Date(), 0).getFullYear()} · All figures are live from your DayLoop workspace.</p>
    </div>
  );
}
