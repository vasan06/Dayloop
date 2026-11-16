import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Task = { status: string; project_id?: string | null; created_at?: string; completed_at?: string | null };
type Project = { id: string; name: string };
type Note = { updated_at: string };
type CalendarEvent = { start_at: string };
type Habit = { id: string; name: string; consistency_30d: number; current_streak: number; completed_today: boolean };
type Transaction = { amount: string | number; transaction_type: string; transaction_date: string; currency: string };
type Goal = { id: string; title: string; current_value: number; target_value?: number; unit?: string; status: string };

const chartColors = ["#69465f", "#df785f", "#d6a64d", "#8c9a7b", "#a996c7", "#bd8a78"];
const axisStyle = { fill: "#9a8b87", fontSize: 10 };
const tooltipStyle = { border: "1px solid #eadfd4", borderRadius: 10, background: "#fffaf3", color: "#493744", fontSize: 11 };

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <article className="analytics-panel"><div className="analytics-heading"><div><span>{eyebrow}</span><h3>{title}</h3></div></div>{children}</article>;
}

function EmptyChart({ children = "Add a few records to reveal your progress here." }: { children?: string }) {
  return <div className="analytics-empty"><span className="analytics-empty-mark">↗</span><p>{children}</p></div>;
}

function buildWeeklyActivity(tasks: Task[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    return { key, day: date.toLocaleDateString("en", { weekday: "short" }), completed: 0, created: 0 };
  });
  const lookup = new Map(days.map((day) => [day.key, day]));
  tasks.forEach((task) => {
    if (task.created_at) {
      const day = lookup.get(task.created_at.slice(0, 10));
      if (day) day.created += 1;
    }
    if (task.completed_at) {
      const day = lookup.get(task.completed_at.slice(0, 10));
      if (day) day.completed += 1;
    }
  });
  return days;
}

function buildMonthlyFinance(transactions: Transaction[]) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
    return { key, month: date.toLocaleDateString("en", { month: "short" }), income: 0, expenses: 0 };
  });
  const lookup = new Map(months.map((month) => [month.key, month]));
  transactions.forEach((transaction) => {
    const month = lookup.get(transaction.transaction_date.slice(0, 7));
    if (month) month[transaction.transaction_type === "income" ? "income" : "expenses"] += Number(transaction.amount);
  });
  return months;
}

export function OverviewAnalytics({ tasks, habits, transactions, goals }: { tasks: Task[]; habits: Habit[]; transactions: Transaction[]; goals: Goal[] }) {
  const weekly = useMemo(() => buildWeeklyActivity(tasks), [tasks]);
  const monthly = useMemo(() => buildMonthlyFinance(transactions), [transactions]);
  const statuses = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => counts.set(task.status, (counts.get(task.status) ?? 0) + 1));
    return Array.from(counts, ([name, value]) => ({ name: name.replaceAll("_", " "), value }));
  }, [tasks]);
  const activeGoals = goals.filter((goal) => goal.status === "active" && Number(goal.target_value) > 0);
  return <section className="analytics-section">
    <div className="analytics-section-title"><div><span className="section-kicker">YOUR PROGRESS, MADE VISIBLE</span><h2>Patterns worth noticing</h2></div><span className="analytics-live">Based on your records</span></div>
    <div className="analytics-grid">
      <Panel eyebrow="TASK MOMENTUM · 7 DAYS" title="Work completed over time">
        {tasks.length ? <ResponsiveContainer width="100%" height={210}><LineChart data={weekly} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="completed" name="Completed" stroke="#69465f" strokeWidth={3} dot={{ r: 3, fill: "#df785f" }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer> : <EmptyChart /> }
      </Panel>
      <Panel eyebrow="WORKLOAD · ALL TASKS" title="Where things stand">
        {statuses.length ? <div className="analytics-donut"><ResponsiveContainer width="100%" height={190}><PieChart><Pie data={statuses} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={3}>{statuses.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="analytics-legend">{statuses.map((entry, index) => <span key={entry.name}><i style={{ background: chartColors[index % chartColors.length] }} />{entry.name}<b>{entry.value}</b></span>)}</div></div> : <EmptyChart /> }
      </Panel>
      <Panel eyebrow="CONSISTENCY · LAST 30 DAYS" title="Your habit rhythm">
        {habits.length ? <ResponsiveContainer width="100%" height={210}><BarChart data={habits.slice(0, 7)} layout="vertical" margin={{ top: 4, right: 14, left: 4, bottom: 0 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} unit="%" /><YAxis type="category" dataKey="name" width={82} tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [value + "%", "Consistency"]} /><Bar dataKey="consistency_30d" name="Consistency" fill="#8c9a7b" radius={[0, 6, 6, 0]} barSize={13} /></BarChart></ResponsiveContainer> : <EmptyChart /> }
      </Panel>
      <Panel eyebrow="MONEY · LAST 6 MONTHS" title="Income and spending">
        {transactions.length ? <ResponsiveContainer width="100%" height={210}><BarChart data={monthly} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="income" name="Income" fill="#8c9a7b" radius={[5, 5, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#df785f" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart children="Record income or expenses to see your money trend." /> }
      </Panel>
      <Panel eyebrow="GOALS · ACTIVE" title="Progress toward what matters">
        {activeGoals.length ? <div className="goal-chart-list">{activeGoals.slice(0, 5).map((goal) => { const value = Math.min(100, Math.max(0, Number(goal.current_value) / Number(goal.target_value) * 100)); return <div className="goal-chart-row" key={goal.id}><div><strong>{goal.title}</strong><span>{Number(goal.current_value)} / {Number(goal.target_value)} {goal.unit ?? ""}</span></div><div className="goal-chart-track"><i style={{ width: value + "%" }} /></div><b>{Math.round(value)}%</b></div>; })}</div> : <EmptyChart children="Set measurable goals with a target to track your progress." /> }
      </Panel>
      <Panel eyebrow="MOMENTUM · HABITS" title="Streaks you're building">
        {habits.length ? <div className="streak-chart-list">{habits.slice(0, 5).map((habit) => <div key={habit.id}><span className="streak-chart-icon">✳</span><strong>{habit.name}</strong><b>{habit.current_streak} days</b><small>{habit.completed_today ? "Checked in today" : "Ready for today's check-in"}</small></div>)}</div> : <EmptyChart children="Your habit streaks will grow here as you check in." /> }
      </Panel>
    </div>
  </section>;
}

export function HabitAnalytics({ habits }: { habits: Habit[] }) {
  return <Panel eyebrow="CONSISTENCY · LAST 30 DAYS" title="Habit consistency">
    {habits.length ? <ResponsiveContainer width="100%" height={Math.max(210, habits.length * 42)}><BarChart data={habits} layout="vertical" margin={{ top: 8, right: 20, left: 6, bottom: 8 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} unit="%" /><YAxis type="category" dataKey="name" width={100} tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [value + "%", "Consistency"]} /><Bar dataKey="consistency_30d" fill="#8c9a7b" radius={[0, 6, 6, 0]} barSize={16} /></BarChart></ResponsiveContainer> : <EmptyChart /> }
  </Panel>;
}

export function FinanceAnalytics({ transactions }: { transactions: Transaction[] }) {
  const monthly = useMemo(() => buildMonthlyFinance(transactions), [transactions]);
  return <Panel eyebrow="CASH FLOW · LAST 6 MONTHS" title="Income vs. expenses">
    {transactions.length ? <ResponsiveContainer width="100%" height={250}><BarChart data={monthly} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="income" fill="#8c9a7b" radius={[5, 5, 0, 0]} /><Bar dataKey="expenses" fill="#df785f" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart children="Record a few transactions to reveal your cash-flow trend." /> }
  </Panel>;
}

export function GoalAnalytics({ goals }: { goals: Goal[] }) {
  const active = goals.filter((goal) => goal.status === "active" && Number(goal.target_value) > 0);
  return <Panel eyebrow="MEASURABLE PROGRESS" title="Goal completion">
    {active.length ? <ResponsiveContainer width="100%" height={Math.max(210, active.length * 48)}><BarChart data={active} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 8 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} unit="%" /><YAxis type="category" dataKey="title" width={125} tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [Math.round(Number(value)) + "%", "Complete"]} /><Bar dataKey={(goal: Goal) => Math.min(100, Math.max(0, Number(goal.current_value) / Number(goal.target_value) * 100))} name="Complete" fill="#a996c7" radius={[0, 6, 6, 0]} barSize={17} /></BarChart></ResponsiveContainer> : <EmptyChart children="Add a target value to a goal to make its progress measurable." /> }
  </Panel>;
}

export function TaskAnalytics({ tasks }: { tasks: Task[] }) {
  const weekly = useMemo(() => buildWeeklyActivity(tasks), [tasks]);
  return <Panel eyebrow="TASK MOMENTUM · LAST 7 DAYS" title="Tasks created and completed">
    {tasks.length ? <ResponsiveContainer width="100%" height={210}><BarChart data={weekly} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="created" name="Created" fill="#a996c7" radius={[4, 4, 0, 0]} /><Bar dataKey="completed" name="Completed" fill="#8c9a7b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart children="Add tasks to see your weekly progress." /> }
  </Panel>;
}

export function ProjectAnalytics({ projects, tasks }: { projects: Project[]; tasks: Task[] }) {
  const data = projects.slice(0, 8).map((project) => {
    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    const completed = projectTasks.filter((task) => task.status === "completed").length;
    return {
      name: project.name,
      completed,
      remaining: projectTasks.length - completed,
      total: projectTasks.length,
    };
  });
  return <Panel eyebrow="PROJECT DELIVERY · LIVE" title="Work completed by project">
    {projects.length ? <ResponsiveContainer width="100%" height={Math.max(210, data.length * 38)}><BarChart data={data} layout="vertical" margin={{ top: 8, right: 18, left: 8, bottom: 8 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={112} tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="completed" name="Completed" stackId="tasks" fill="#8c9a7b" /><Bar dataKey="remaining" name="Remaining" stackId="tasks" fill="#df785f" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart children="Create a project and assign tasks to track delivery." /> }
  </Panel>;
}

export function NotesAnalytics({ notes }: { notes: Note[] }) {
  const data = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
      return { key, day: date.toLocaleDateString("en", { weekday: "short" }), updated: 0 };
    });
    const lookup = new Map(days.map((day) => [day.key, day]));
    notes.forEach((note) => {
      const day = lookup.get(note.updated_at.slice(0, 10));
      if (day) day.updated += 1;
    });
    return days;
  }, [notes]);
  return <Panel eyebrow="KNOWLEDGE · LAST 7 DAYS" title="Pages you've revisited">
    {notes.length ? <ResponsiveContainer width="100%" height={190}><LineChart data={data} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="updated" name="Pages updated" stroke="#a996c7" strokeWidth={3} dot={{ r: 3, fill: "#69465f" }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer> : <EmptyChart children="Create pages to build your personal knowledge history." /> }
  </Panel>;
}

export function CalendarAnalytics({ events }: { events: CalendarEvent[] }) {
  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
      return { key, day: date.toLocaleDateString("en", { weekday: "short" }), events: 0 };
    });
    const lookup = new Map(days.map((day) => [day.key, day]));
    events.forEach((event) => {
      const date = new Date(event.start_at);
      const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
      const day = lookup.get(key);
      if (day) day.events += 1;
    });
    return days;
  }, [events]);
  return <Panel eyebrow="YOUR WEEK · SCHEDULE" title="Planned time">
    {events.length ? <ResponsiveContainer width="100%" height={210}><BarChart data={data} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="events" name="Events" fill="#a996c7" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart children="Add events to see how your week is taking shape." /> }
  </Panel>;
}

export function TrackerAnalytics({ entries, unit }: { entries: { recorded_at: string; numeric_value?: number | string | null }[]; unit?: string }) {
  const data = [...entries].reverse().filter((entry) => entry.numeric_value !== null && entry.numeric_value !== undefined).map((entry) => ({ date: new Date(entry.recorded_at).toLocaleDateString("en", { month: "short", day: "numeric" }), value: Number(entry.numeric_value) }));
  return <div className="tracker-chart">{data.length ? <ResponsiveContainer width="100%" height={125}><LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid stroke="#eee5dc" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis tick={axisStyle} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [value + (unit ? " " + unit : ""), "Recorded"]} /><Line type="monotone" dataKey="value" stroke="#69465f" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer> : <EmptyChart children="Record values to build this tracker's trend." />}</div>;
}
