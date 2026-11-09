import { useState } from "react";
import { Card, CardHead, ErrorBox, PageHead, Seg, Skeleton } from "../components/ui";
import { Bars, Heatmap, LineChart } from "../components/charts";
import { useHabits, useInsights } from "../hooks/data";
import { money, num, shortDate } from "../lib/format";

export default function Analytics() {
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const data = useInsights(Number(range));
  const habits = useHabits();
  const s = data.data?.series ?? [];
  const labels = s.map((d) => shortDate(d.day + "T00:00"));
  const sum = (f: (d: (typeof s)[number]) => number) => s.reduce((a, d) => a + f(d), 0);
  const completed = sum((d) => d.tasks_completed), created = sum((d) => d.tasks_created);
  const income = sum((d) => num(d.income)), expenses = sum((d) => num(d.expenses));
  const avgConsistency = habits.data?.length ? Math.round(habits.data.reduce((a, h) => a + h.consistency_30d, 0) / habits.data.length) : 0;
  const total = Math.max(1, habits.data?.length ?? 1);
  const heat = s.slice(-42);

  return (
    <>
      <PageHead title="Analytics" sub="How your time, habits and money are trending"><Seg value={range} options={[["7", "7d"], ["30", "30d"], ["90", "90d"]]} onChange={setRange} /></PageHead>
      {data.isError ? <ErrorBox error={data.error} retry={() => void data.refetch()} /> : (
        <div className="g">
          <Card tone="butter" className="s3"><div className="mono">Tasks completed</div><div className="big">{completed}</div></Card>
          <Card tone="mint" className="s3"><div className="mono">Completion rate</div><div className="big">{created ? Math.round((completed / created) * 100) : 0}%</div></Card>
          <Card tone="sky" className="s3"><div className="mono">Habit consistency</div><div className="big">{avgConsistency}%</div></Card>
          <Card tone="blush" className="s3"><div className="mono">Net cash</div><div className="big" style={{ fontSize: 24 }}>{money(income - expenses)}</div></Card>
          <Card className="s8"><CardHead mono="Output" title="Created vs completed" />{data.isLoading ? <Skeleton rows={5} /> : <LineChart labels={labels} series={[{ name: "Completed", values: s.map((d) => d.tasks_completed), color: "var(--acc)" }, { name: "Created", values: s.map((d) => d.tasks_created), color: "var(--amber)" }]} />}</Card>
          <Card className="s4"><CardHead mono="Habits" title="Daily check-ins" />{s.length ? <Heatmap cells={heat.map((d) => (d.habits_done === 0 ? 0 : Math.min(4, Math.ceil((d.habits_done / total) * 4))))} startWeekday={new Date(heat[0].day + "T00:00").getDay()} tips={heat.map((d) => `${shortDate(d.day + "T00:00")}\n${d.habits_done} done`)} /> : <Skeleton />}</Card>
          <Card className="s6"><CardHead mono="Money" title="Income vs expenses" />{s.length ? <LineChart height={190} labels={labels} format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} series={[{ name: "Income", values: s.map((d) => num(d.income)), color: "var(--green)" }, { name: "Expenses", values: s.map((d) => num(d.expenses)), color: "var(--rose)" }]} /> : <Skeleton />}</Card>
          <Card className="s6"><CardHead mono="Habits" title="Completions per day" />{s.length ? <Bars labels={s.slice(-14).map((d) => new Date(d.day + "T00:00").getDate().toString())} values={s.slice(-14).map((d) => d.habits_done)} color="var(--amber)" height={190} /> : <Skeleton />}</Card>
        </div>
      )}
    </>
  );
}
