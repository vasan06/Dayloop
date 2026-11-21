import { useState } from "react";
import { Card, CardHead, Empty, ErrorBox, PageHead, Seg, Skeleton } from "../components/ui";
import { Heatmap, Spark } from "../components/charts";
import { AxisBars, AxisLineChart } from "../components/InteractiveCharts";
import { useHabits, useInsights } from "../hooks/data";
import { money, num, shortDate } from "../lib/format";

export default function Analytics() {
  const [range, setRange] = useState<"1" | "7" | "30" | "90" | "365">("30");
  const data = useInsights(Number(range));
  const habits = useHabits();
  const s = data.data?.series ?? [];
  const labels = s.map((d) => shortDate(d.day + "T00:00"));
  const sum = (f: (d: (typeof s)[number]) => number) => s.reduce((a, d) => a + f(d), 0);
  const completed = sum((d) => d.tasks_completed), created = sum((d) => d.tasks_created);
  const income = sum((d) => num(d.income)), expenses = sum((d) => num(d.expenses));
  const projectsCreated = sum((d) => d.projects_created ?? 0);
  const eventsCount = sum((d) => d.events_count ?? 0);
  const notesCreated = sum((d) => d.notes_created ?? 0);
  const avgConsistency = habits.data?.length ? Math.round(habits.data.reduce((a, h) => a + h.consistency_30d, 0) / habits.data.length) : 0;
  const total = Math.max(1, habits.data?.length ?? 1);
  const heat = s.slice(-42);

  return (
    <>
      <PageHead title="Analytics" sub="How your time, habits and money are trending"><Seg value={range} options={[["1", "Day"], ["7", "Week"], ["30", "Month"], ["90", "Quarter"], ["365", "Year"]]} onChange={setRange} /></PageHead>
      {data.isError ? <ErrorBox error={data.error} retry={() => void data.refetch()} /> : habits.isError ? <ErrorBox error={habits.error} retry={() => void habits.refetch()} /> : (
        <div className="g">
          <Card tone="butter" className="s3"><div className="mono">Tasks completed</div><div className="big">{data.isLoading ? "—" : completed}</div></Card>
          <Card tone="mint" className="s3"><div className="mono">Tasks created</div><div className="big">{data.isLoading ? "—" : created}</div></Card>
          <Card tone="sky" className="s3"><div className="mono">Habit consistency</div><div className="big">{habits.isLoading ? "—" : `${avgConsistency}%`}</div></Card>
          <Card tone="blush" className="s3"><div className="mono">Net cash</div><div className="big" style={{ fontSize: 24 }}>{data.isLoading ? "—" : money(income - expenses)}</div></Card>
          <Card className="s8"><CardHead mono="Output" title="Created vs completed" />{data.isLoading ? <Skeleton rows={5} /> : s.length ? <AxisLineChart labels={labels} yLabel="Tasks" series={[{ name: "Completed", values: s.map((d) => d.tasks_completed), color: "var(--acc)" }, { name: "Created", values: s.map((d) => d.tasks_created), color: "var(--amber)" }]} /> : <Empty title="No task activity yet" hint="Task trends appear here after you start recording work." />}</Card>
          <Card className="s4"><CardHead mono="Habits" title="Daily check-ins" />{data.isLoading ? <Skeleton /> : s.length ? <Heatmap cells={heat.map((d) => (d.habits_done === 0 ? 0 : Math.min(4, Math.ceil((d.habits_done / total) * 4))))} startWeekday={new Date(heat[0].day + "T00:00").getDay()} tips={heat.map((d) => `${shortDate(d.day + "T00:00")}\n${d.habits_done} done`)} /> : <Empty title="No habit activity yet" hint="Check in to a habit to build your activity map." />}</Card>
          <Card className="s6"><CardHead mono="Money" title="Income vs expenses" />{data.isLoading ? <Skeleton /> : s.length ? <AxisLineChart height={220} labels={labels} yLabel="Amount" format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))} series={[{ name: "Income", values: s.map((d) => num(d.income)), color: "var(--green)" }, { name: "Expenses", values: s.map((d) => num(d.expenses)), color: "var(--rose)" }]} /> : <Empty title="No finance data yet" hint="Record income and expenses to see the trend." />}</Card>
          <Card className="s6 habit-bars"><CardHead mono="Habits" title="Completions per day" />{data.isLoading ? <Skeleton /> : s.length ? <AxisBars labels={s.slice(-14).map((d) => shortDate(d.day + "T00:00"))} values={s.slice(-14).map((d) => d.habits_done)} color="var(--amber)" height={220} yLabel="Completions" /> : <Empty title="No habit check-ins yet" hint="Daily check-ins will appear here." />}</Card>
          <Card className="s4"><CardHead mono="Projects" title="Projects created" /><div className="big">{data.isLoading ? "—" : projectsCreated}</div>{s.length > 0 && <div className="metric-spark"><Spark values={s.slice(-30).map((d) => d.projects_created ?? 0)} color="var(--violet)" w={220} h={54} /><span className="mono">30-day creation trend</span></div>}</Card>
          <Card className="s4"><CardHead mono="Events" title="Events scheduled" /><div className="big">{data.isLoading ? "—" : eventsCount}</div>{s.length > 0 && <div className="metric-spark"><Spark values={s.slice(-30).map((d) => d.events_count ?? 0)} color="var(--blue)" w={220} h={54} /><span className="mono">30-day scheduling trend</span></div>}</Card>
          <Card className="s4"><CardHead mono="Notes" title="Pages created" /><div className="big">{data.isLoading ? "—" : notesCreated}</div>{s.length > 0 && <div className="metric-spark"><Spark values={s.slice(-30).map((d) => d.notes_created ?? 0)} color="var(--rose)" w={220} h={54} /><span className="mono">30-day writing trend</span></div>}</Card>
        </div>
      )}
    </>
  );
}
