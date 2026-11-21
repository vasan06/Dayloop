import { cachedResponse } from "./mobileData";

type Row = Record<string, unknown>;
const rows = async (path: string): Promise<Row[]> => {
  const result = await cachedResponse<{items?:Row[]}>(path);
  return result?.items ?? [];
};
const str = (value: unknown): string => typeof value === "string" ? value : "";
const num = (value: unknown): number => Number(value) || 0;
const day = (value: unknown): string => str(value).slice(0, 10);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
function daysBack(count: number): string[] {
  const current = new Date(); current.setHours(12,0,0,0);
  const values: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(current);
    date.setDate(date.getDate() - i);
    values.push([date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-"));
  }
  return values;
}
async function metrics(days: number): Promise<object> {
  const [tasks,habits,projects,notes,events,txs] = await Promise.all([
    rows("/tasks"),rows("/habits"),rows("/projects"),rows("/notes"),rows("/calendar/events"),rows("/finance/transactions"),
  ]);
  const entries = await Promise.all(habits.map((h) => rows("/habits/"+str(h.id)+"/entries")));
  const series = daysBack(Math.min(365,Math.max(1,days))).map((date) => {
    const created = tasks.filter((t) => day(t.created_at) === date);
    const completed = tasks.filter((t) => day(t.completed_at) === date);
    const habitCompleted = entries.flat().filter((e) => day(e.entry_date) === date && e.status === "completed");
    const income = txs.filter((t) => day(t.transaction_date) === date && t.transaction_type === "income");
    const expenses = txs.filter((t) => day(t.transaction_date) === date && t.transaction_type === "expense");
    const p = projects.filter((v) => day(v.created_at) === date);
    const e = events.filter((v) => day(v.start_at) === date);
    const n = notes.filter((v) => day(v.created_at) === date);
    const largest = (list: Row[]) => [...list].sort((a,b)=>num(b.amount)-num(a.amount))[0];
    return {
      day:date, tasks_completed:completed.length, tasks_created:created.length,
      habits_done:habitCompleted.length, income:income.reduce((s,v)=>s+num(v.amount),0),
      expenses:expenses.reduce((s,v)=>s+num(v.amount),0),
      projects_created:p.length, events_count:e.length, notes_created:n.length,
      completed_task:str(completed[0]?.title)||null, created_task:str(created[0]?.title)||null,
      completed_habit:habits.find((h)=>h.id===habitCompleted[0]?.habit_id)?.name ?? null,
      created_project:str(p[0]?.name)||null, scheduled_event:str(e[0]?.title)||null,
      created_note:str(n[0]?.title)||null,
      largest_income:largest(income)?.amount??null, income_description:str(largest(income)?.description)||null,
      largest_expense:largest(expenses)?.amount??null, expense_description:str(largest(expenses)?.description)||null,
    };
  });
  const open = tasks.filter((t)=>t.status!=="completed"&&t.status!=="cancelled");
  return {
    days:series.length, series,
    totals:{
      open_tasks:open.length,
      completed_tasks:tasks.filter((t)=>t.status==="completed").length,
      overdue_tasks:open.filter((t)=>str(t.due_at)!==""&&Date.parse(str(t.due_at))<Date.now()).length,
    },
  };
}
async function financeSummary(): Promise<object> {
  const [transactions,categories] = await Promise.all([rows("/finance/transactions"),rows("/finance/categories")]);
  const month = new Date().toISOString().slice(0,7);
  const current = transactions.filter((t)=>day(t.transaction_date).startsWith(month));
  const expenses = current.filter((t)=>t.transaction_type==="expense");
  const income = current.filter((t)=>t.transaction_type==="income").reduce((a,v)=>a+num(v.amount),0);
  const spent = expenses.reduce((a,v)=>a+num(v.amount),0);
  const categoriesById = new Map(categories.map((c)=>[str(c.id),str(c.name)]));
  const sums = new Map<string,number>();
  for (const expense of expenses) {
    const name = categoriesById.get(str(expense.category_id)) || "Other";
    sums.set(name,(sums.get(name)??0)+num(expense.amount));
  }
  return { month, currency:"INR", income, expenses:spent, net:income-spent,
    spending_by_category:[...sums].map(([label,value])=>({label,value})) };
}
async function habitInsights(days: number): Promise<object> {
  const habits = await rows("/habits");
  const entries = await Promise.all(habits.map((h) => rows("/habits/"+str(h.id)+"/entries")));
  const dates = daysBack(Math.min(365,Math.max(1,days)));
  return {
    days:dates.length,
    series:dates.map((date)=>{
      const checked = entries.flat().filter((e)=>day(e.entry_date)===date);
      const completed=checked.filter((e)=>e.status==="completed").length;
      return { day:date, completed, skipped:checked.filter((e)=>e.status==="skipped").length,
        missed:checked.filter((e)=>e.status==="missed"||e.status==="failed").length,
        scheduled:habits.length, active:habits.length, streaking:completed,
        completion_rate:habits.length?Math.round(completed/habits.length*100):0 };
    }),
    streaks:habits.map((h)=>({
      habit_id:h.id,name:h.name,current_streak:h.current_streak??0,
      previous_streak_start:h.previous_streak_start??null,previous_streak_end:h.previous_streak_end??null,
      previous_streak_days:h.previous_streak_days??0,last_break_date:h.last_break_date??null,
    })),
  };
}
async function streakOverview(): Promise<object> {
  const habits=await rows("/habits");
  const maximum=habits.reduce((v,h)=>Math.max(v,num(h.current_streak)),0);
  return {timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,today:today(),
    combined:{current:maximum,last_update:today()},longest:maximum,events:[],
    habits:habits.map((h)=>({
      habit_id:h.id,name:h.name,current:num(h.current_streak),start:h.current_streak_start??null,
      last_update:h.current_streak_end??null,break_date:h.last_break_date??null,
    }))};
}
async function searchLocal(query: string): Promise<object> {
  const term=query.trim().toLowerCase();
  const sources:[string,string,string][]=[
    ["/tasks","task","title"],["/projects","project","name"],
    ["/habits","habit","name"],["/notes","note","title"],["/goals","goal","title"],
  ];
  const matches:Row[]=[];
  for (const [path,entity_type,titleKey] of sources) {
    for (const record of await rows(path)) {
      const title=str(record[titleKey]);
      if (term && title.toLowerCase().includes(term)) {
        matches.push({entity_type,id:record.id,title,detail:str(record.description)});
      }
    }
  }
  return {items:matches.slice(0,60)};
}
export async function deriveOffline(path: string): Promise<unknown | null> {
  if (path.startsWith("/insights/overview?days=")) return metrics(Number(new URLSearchParams(path.split("?")[1]).get("days"))||35);
  if (path==="/finance/summary") return financeSummary();
  if (path.startsWith("/habits/insights?days=")) return habitInsights(Number(new URLSearchParams(path.split("?")[1]).get("days"))||42);
  if (path==="/habits/streaks/overview") return streakOverview();
  if (path.startsWith("/search?q=")) return searchLocal(decodeURIComponent(path.split("?q=")[1]));
  if (path==="/notifications/center") return {items:await rows("/notifications"),tasks:await rows("/tasks"),events:await rows("/calendar/events")};
  return null;
}
