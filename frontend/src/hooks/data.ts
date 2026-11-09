import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { isoDate } from "../lib/format";
import { toast } from "../lib/toast";
import type {
  Budget, CalendarEvent, Category, FinanceSummary, Goal, Habit, HabitEntry, Insights, NoteBlock, NotePage,
  Profile, Project, SavingsGoal, SearchResult, Task, Transaction,
} from "../lib/types";

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
const items = <T,>(path: string) => () => apiRequest<{ items: T[] }>(path).then((r) => r.items);

export const keys = {
  profile: ["profile"], tasks: ["tasks"], projects: ["projects"], habits: ["habits"], notes: ["notes"],
  transactions: ["transactions"], categories: ["categories"], budgets: ["budgets"], savings: ["savings"],
  summary: ["finance-summary"], goals: ["goals"], events: ["events"], insights: ["insights"],
} as const;

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => apiRequest<{ item: Profile }>("/profile").then((r) => r.item) });
export const useTasks = () => useQuery({ queryKey: keys.tasks, queryFn: items<Task>("/tasks") });
export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: items<Project>("/projects") });
export const useHabits = () => useQuery({ queryKey: keys.habits, queryFn: items<Habit>("/habits") });
export const useNotes = () => useQuery({ queryKey: keys.notes, queryFn: items<NotePage>("/notes") });
export const useTransactions = () => useQuery({ queryKey: keys.transactions, queryFn: items<Transaction>("/finance/transactions") });
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: items<Category>("/finance/categories") });
export const useBudgets = () => useQuery({ queryKey: keys.budgets, queryFn: items<Budget>("/finance/budgets") });
export const useSavings = () => useQuery({ queryKey: keys.savings, queryFn: items<SavingsGoal>("/finance/savings") });
export const useGoals = () => useQuery({ queryKey: keys.goals, queryFn: items<Goal>("/goals") });
export const useSummary = () => useQuery({ queryKey: keys.summary, queryFn: () => apiRequest<FinanceSummary>("/finance/summary") });
export const useEvents = () => useQuery({ queryKey: keys.events, queryFn: items<CalendarEvent>("/calendar/events") });
export const useInsights = (days: number) =>
  useQuery({ queryKey: [...keys.insights, days], queryFn: () => apiRequest<Insights>(`/insights/overview?days=${days}`) });
export const useSearch = (q: string) =>
  useQuery({ queryKey: ["search", q], queryFn: items<SearchResult>(`/search?q=${encodeURIComponent(q)}`), enabled: q.trim().length >= 2 });
export const useHabitEntries = (id: string | null) =>
  useQuery({ queryKey: ["habit-entries", id], queryFn: items<HabitEntry>(`/habits/${id}/entries`), enabled: Boolean(id) });
export const useNote = (id: string | null) =>
  useQuery({
    queryKey: ["note", id],
    enabled: Boolean(id),
    queryFn: () => apiRequest<{ item: NotePage; blocks: NoteBlock[] }>(`/notes/${id}`),
  });

/** Build a mutation that refreshes the given query keys and shows a toast. */
function useAction<V, R = unknown>(fn: (v: V) => Promise<R>, refresh: QueryKey[], message?: string | ((v: V) => string)) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, vars) => {
      refresh.forEach((key) => void client.invalidateQueries({ queryKey: key }));
      if (message) toast(typeof message === "function" ? message(vars) : message);
    },
  });
}

const everything = [keys.insights, keys.summary];

export const useCreateTask = () =>
  useAction((v: Partial<Task>) => apiRequest("/tasks", { method: "POST", ...json(v) }), [keys.tasks, keys.projects, keys.insights], "Task added");
export const useUpdateTask = () =>
  useAction((v: { id: string } & Partial<Task>) => { const { id, ...rest } = v; return apiRequest(`/tasks/${id}`, { method: "PATCH", ...json(rest) }); }, [keys.tasks, keys.insights]);
export const useDeleteTask = () =>
  useAction((id: string) => apiRequest(`/tasks/${id}`, { method: "DELETE" }), [keys.tasks, keys.projects, keys.insights], "Task deleted");

export const useCreateProject = () =>
  useAction((v: Partial<Project>) => apiRequest("/projects", { method: "POST", ...json(v) }), [keys.projects], "Project created");
export const useUpdateProject = () =>
  useAction((v: { id: string } & Partial<Project>) => { const { id, ...rest } = v; return apiRequest(`/projects/${id}`, { method: "PATCH", ...json(rest) }); }, [keys.projects], "Project updated");
export const useDeleteProject = () =>
  useAction((id: string) => apiRequest(`/projects/${id}`, { method: "DELETE" }), [keys.projects, keys.tasks], "Project archived");

export const useCreateHabit = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/habits", { method: "POST", ...json({ schedule_type: "daily", ...v }) }), [keys.habits], "Habit created");
export const useDeleteHabit = () =>
  useAction((id: string) => apiRequest(`/habits/${id}`, { method: "DELETE" }), [keys.habits], "Habit archived");
export const useCheckHabit = () =>
  useAction(
    (v: { id: string; date?: string; status: "completed" | "missed" }) =>
      apiRequest(`/habits/${v.id}/entries/${v.date ?? isoDate()}`, { method: "PUT", ...json({ status: v.status }) }),
    [keys.habits, ["habit-entries"], keys.insights],
  );

export const useCreateNote = () =>
  useAction((v: { title: string }) => apiRequest<{ item: NotePage }>("/notes", { method: "POST", ...json(v) }), [keys.notes]);
export const useRenameNote = () =>
  useAction((v: { id: string; title: string }) => apiRequest(`/notes/${v.id}`, { method: "PATCH", ...json({ title: v.title }) }), [keys.notes]);
export const useDeleteNote = () =>
  useAction((id: string) => apiRequest(`/notes/${id}`, { method: "DELETE" }), [keys.notes], "Note deleted");
export const useSaveBlocks = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; blocks: { type: string; content: { text: string } }[] }) =>
      apiRequest(`/notes/${v.id}/blocks`, { method: "PUT", ...json({ blocks: v.blocks }) }),
    onSuccess: (_d, v) => {
      void client.invalidateQueries({ queryKey: keys.notes });
      void client.invalidateQueries({ queryKey: ["note", v.id] });
    },
  });
};

export const useCreateTransaction = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/finance/transactions", { method: "POST", ...json({ currency: "INR", ...v }) }), [keys.transactions, keys.budgets, ...everything], "Transaction saved");
export const useDeleteTransaction = () =>
  useAction((id: string) => apiRequest(`/finance/transactions/${id}`, { method: "DELETE" }), [keys.transactions, keys.budgets, ...everything], "Transaction removed");
export const useCreateCategory = () =>
  useAction((v: { name: string; category_type: "income" | "expense" }) => apiRequest("/finance/categories", { method: "POST", ...json(v) }), [keys.categories]);
export const useCreateBudget = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/finance/budgets", { method: "POST", ...json(v) }), [keys.budgets], "Budget created");
export const useCreateSavings = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/finance/savings", { method: "POST", ...json(v) }), [keys.savings], "Savings goal created");

export const useCreateGoal = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/goals", { method: "POST", ...json(v) }), [keys.goals], "Goal created");
export const useUpdateGoal = () =>
  useAction((v: { id: string } & Record<string, unknown>) => { const { id, ...rest } = v; return apiRequest(`/goals/${id}`, { method: "PATCH", ...json(rest) }); }, [keys.goals]);

export const useCreateEvent = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/calendar/events", { method: "POST", ...json(v) }), [keys.events], "Event added");
export const useDeleteEvent = () =>
  useAction((id: string) => apiRequest(`/calendar/events/${id}`, { method: "DELETE" }), [keys.events], "Event deleted");

export const useSaveProfile = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: Record<string, unknown>) => apiRequest<{ item: Profile }>("/profile", { method: "PUT", ...json(v) }),
    onSuccess: (data) => { client.setQueryData(keys.profile, data.item); toast("Profile saved"); },
  });
};
