import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { isoDate } from "../lib/format";
import { toast } from "../lib/toast";
import type {
  Budget, CalendarEvent, Category, FinanceSummary, Goal, Habit, HabitEntry, HabitInsights, Insights, NoteBlock, NotePage,
  Notification, Profile, Project, SavingsGoal, SearchResult, Task, TaskNoteBlock, Transaction, Tracker, TrackerEntry,
} from "../lib/types";

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
const items = <T,>(path: string) => () => apiRequest<{ items: T[] }>(path).then((r) => r.items);

export const keys = {
  profile: ["profile"], tasks: ["tasks"], projects: ["projects"], habits: ["habits"], notes: ["notes"],
  transactions: ["transactions"], categories: ["categories"], budgets: ["budgets"], savings: ["savings"],
  summary: ["finance-summary"], goals: ["goals"], events: ["events"], insights: ["insights"],
  notifications: ["notifications"], trackers: ["trackers"],
} as const;

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => apiRequest<{ item: Profile }>("/profile").then((r) => r.item) });
export const useTasks = () => useQuery({ queryKey: keys.tasks, queryFn: items<Task>("/tasks") });
export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: items<Project>("/projects") });
export const useHabits = () => useQuery({ queryKey: keys.habits, queryFn: items<Habit>("/habits") });
export const useHabitInsights = (days = 42) =>
  useQuery({ queryKey: ["habit-insights", days], queryFn: () => apiRequest<HabitInsights>(`/habits/insights?days=${days}`) });
export const useNotes = () => useQuery({ queryKey: keys.notes, queryFn: items<NotePage>("/notes") });
export const useTransactions = () => useQuery({ queryKey: keys.transactions, queryFn: items<Transaction>("/finance/transactions") });
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: items<Category>("/finance/categories") });
export const useBudgets = () => useQuery({ queryKey: keys.budgets, queryFn: items<Budget>("/finance/budgets") });
export const useSavings = () => useQuery({ queryKey: keys.savings, queryFn: items<SavingsGoal>("/finance/savings") });
export const useGoals = () => useQuery({ queryKey: keys.goals, queryFn: items<Goal>("/goals") });
export const useTrackers = () => useQuery({ queryKey: keys.trackers, queryFn: items<Tracker>("/trackers") });
export const useTrackerEntries = (id: string) => useQuery({
  queryKey: ["tracker-entries", id], queryFn: items<TrackerEntry>(`/trackers/${id}/entries`),
});
type TrackerInput = Omit<Tracker, "id" | "frequency" | "metric_type"> & { frequency: string; metric_type: string };
export const useCreateTracker = () =>
  useAction((tracker: TrackerInput) =>
    apiRequest("/trackers", { method: "POST", ...json(tracker) }), [keys.trackers], "Tracker created");
export const useUpdateTracker = () =>
  useAction(({ id, ...changes }: TrackerInput & { id: string }) =>
    apiRequest(`/trackers/${id}`, { method: "PATCH", ...json(changes) }), [keys.trackers], "Tracker updated");
export const useArchiveTracker = () =>
  useAction((id: string) => apiRequest(`/trackers/${id}`, { method: "DELETE" }), [keys.trackers], "Tracker archived");
export const useAddTrackerEntry = () => useAction(({ id, ...entry }: { id: string; numeric_value: number; notes: string }) =>
  apiRequest(`/trackers/${id}/entries`, { method: "POST", ...json(entry) }), [["tracker-entries"]], "Entry recorded");
export const useSummary = () => useQuery({ queryKey: keys.summary, queryFn: () => apiRequest<FinanceSummary>("/finance/summary") });
export const useEvents = () => useQuery({ queryKey: keys.events, queryFn: items<CalendarEvent>("/calendar/events") });
export const useNotifications = (unreadOnly = false) => useQuery({ queryKey: [...keys.notifications, unreadOnly], queryFn: items<Notification>(`/notifications${unreadOnly ? "?unread_only=true" : ""}`) });
export const useMarkNotificationRead = () => useAction((id: string) => apiRequest(`/notifications/${id}/read`, { method: "PATCH" }), [keys.notifications]);
export const useNotificationCenter = () => useQuery({
  queryKey: ["notification-center"],
  queryFn: () => apiRequest<{ items: Notification[]; tasks: Task[]; events: CalendarEvent[] }>("/notifications/center"),
});
export const useMarkAllNotificationsRead = () =>
  useAction(() => apiRequest("/notifications/read-all", { method: "POST" }), [keys.notifications, ["notification-center"]]);
export const useDismissNotification = () =>
  useAction((id: string) => apiRequest(`/notifications/${id}/dismiss`, { method: "PATCH" }), [keys.notifications, ["notification-center"]]);
export const useStreakOverview = () => useQuery({
  queryKey: ["streaks"],
  queryFn: () => apiRequest<{
    timezone: string;
    today: string;
    combined: { current: number; last_update: string };
    habits: Array<{ habit_id: string; name: string; current: number; start: string | null; last_update: string; break_date: string | null }>;
    events: Array<{ habit_id: string | null; event_type: string; event_date: string; streak_length: number; reason: string; created_at: string }>;
    longest: number;
  }>("/habits/streaks/overview"),
});
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
const taskQueries = [keys.tasks, keys.projects, keys.insights, ["streaks"], ["notification-center"], ["search"]];
const habitQueries = [keys.habits, ["habit-entries"], ["habit-insights"], keys.insights, ["streaks"], ["search"]];

export const useCreateTask = () =>
  useAction((v: Partial<Task>) => apiRequest("/tasks", { method: "POST", ...json(v) }), taskQueries, "Task added");
export const useUpdateTask = () =>
  useAction((v: { id: string } & Partial<Task>) => { const { id, ...rest } = v; return apiRequest(`/tasks/${id}`, { method: "PATCH", ...json(rest) }); }, taskQueries);
export const useDeleteTask = () =>
  useAction((id: string) => apiRequest(`/tasks/${id}`, { method: "DELETE" }), taskQueries, "Task deleted");
export const useTaskNotes = (id: string | null) => useQuery({
  queryKey: ["task-notes", id],
  enabled: Boolean(id),
  queryFn: () => apiRequest<{ items: TaskNoteBlock[]; updated_at: string | null }>(`/tasks/${id}/notes`),
});
export function useSaveTaskNotes() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, blocks }: { id: string; blocks: TaskNoteBlock[] }) =>
      apiRequest<{ items: TaskNoteBlock[]; updated_at: string }>(`/tasks/${id}/notes`, { method: "PUT", ...json({ blocks }) }),
    onSuccess: (data, { id }) => {
      client.setQueryData(["task-notes", id], data);
      toast("Task notes saved");
    },
  });
}

export const useCreateProject = () =>
  useAction((v: Partial<Project>) => apiRequest("/projects", { method: "POST", ...json(v) }), [keys.projects], "Project created");
export const useUpdateProject = () =>
  useAction((v: { id: string } & Partial<Project>) => { const { id, ...rest } = v; return apiRequest(`/projects/${id}`, { method: "PATCH", ...json(rest) }); }, [keys.projects], "Project updated");
export const useDeleteProject = () =>
  useAction((id: string) => apiRequest(`/projects/${id}`, { method: "DELETE" }), [keys.projects, keys.tasks], "Project archived");

export const useCreateHabit = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/habits", { method: "POST", ...json({ schedule_type: "daily", ...v }) }), habitQueries, "Habit created");
export const useUpdateHabit = () =>
  useAction((v: { id: string } & Record<string, unknown>) => {
    const { id, ...rest } = v;
    return apiRequest(`/habits/${id}`, { method: "PATCH", ...json(rest) });
  }, habitQueries, "Habit updated");
export const useDeleteHabit = () =>
  useAction((id: string) => apiRequest(`/habits/${id}`, { method: "DELETE" }), habitQueries, "Habit archived");
export const useCheckHabit = () =>
  useAction(
    (v: { id: string; date?: string; status: "completed" | "skipped" | "missed"; value?: number | null; note?: string }) =>
      apiRequest(`/habits/${v.id}/entries/${v.date ?? isoDate()}`, { method: "PUT", ...json({ status: v.status, value: v.value, note: v.note }) }),
    habitQueries,
  );
export const useClearHabitEntry = () =>
  useAction((v: { id: string; date?: string }) => apiRequest(`/habits/${v.id}/entries/${v.date ?? isoDate()}`, { method: "DELETE" }), habitQueries, "Habit entry cleared");

export const useCreateNote = () =>
  useAction((v: { title: string }) => apiRequest<{ item: NotePage }>("/notes", { method: "POST", ...json(v) }), [keys.notes]);
export const useDeleteNote = () =>
  useAction((id: string) => apiRequest(`/notes/${id}`, { method: "DELETE" }), [keys.notes], "Note deleted");
export const useCreateTransaction = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/finance/transactions", { method: "POST", ...json({ currency: "INR", ...v }) }), [keys.transactions, keys.categories, keys.budgets, ...everything], "Transaction saved");
export const useDeleteTransaction = () =>
  useAction((id: string) => apiRequest(`/finance/transactions/${id}`, { method: "DELETE" }), [keys.transactions, keys.budgets, ...everything], "Transaction removed");
export const useCreateCategory = () =>
  useAction((v: { name: string; category_type: "income" | "expense" }) => apiRequest("/finance/categories", { method: "POST", ...json(v) }), [keys.categories]);
export const useCreateBudget = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/finance/budgets", { method: "POST", ...json(v) }), [keys.budgets], "Budget created");
export const useCreateSavings = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/finance/savings", { method: "POST", ...json(v) }), [keys.savings], "Savings goal created");

const goalQueries = [keys.goals, ["search"]];
export const useCreateGoal = () =>
  useAction((v: Partial<Goal>) => apiRequest("/goals", { method: "POST", ...json(v) }), goalQueries, "Goal created");
export const useUpdateGoal = () =>
  useAction(({ id, ...changes }: { id: string } & Partial<Goal>) =>
    apiRequest(`/goals/${id}`, { method: "PATCH", ...json(changes) }), goalQueries, "Goal updated");
export const useIncrementGoal = () =>
  useAction((id: string) => apiRequest(`/goals/${id}/increment`, { method: "POST" }), goalQueries, "Progress recorded");
export const useDeleteGoal = () =>
  useAction((id: string) => apiRequest(`/goals/${id}`, { method: "DELETE" }), goalQueries, "Goal deleted");

export const useCreateEvent = () =>
  useAction((v: Record<string, unknown>) => apiRequest("/calendar/events", { method: "POST", ...json(v) }), [keys.events, ["notification-center"]], "Event added");
export const useUpdateEvent = () =>
  useAction((v: { id: string; completed: boolean }) => apiRequest(`/calendar/events/${v.id}`, { method: "PATCH", ...json({ completed: v.completed }) }), [keys.events, ["notification-center"]]);
export const useDeleteEvent = () =>
  useAction((id: string) => apiRequest(`/calendar/events/${id}`, { method: "DELETE" }), [keys.events, ["notification-center"]], "Event deleted");

export const useSaveProfile = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: Record<string, unknown>) => apiRequest<{ item: Profile }>("/profile", { method: "PUT", ...json(v) }),
    onSuccess: (data) => { client.setQueryData(keys.profile, data.item); toast("Profile saved"); },
  });
};
