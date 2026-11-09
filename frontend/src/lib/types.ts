export type TaskStatus = "inbox" | "not_started" | "in_progress" | "waiting" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type Task = {
  id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  start_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectStatus = "active" | "on_hold" | "completed";
export type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  task_count: number;
  updated_at: string;
};

export type Habit = {
  id: string;
  name: string;
  description: string;
  habit_type: "positive" | "negative";
  measurement_type: "boolean" | "quantity" | "duration";
  target_value: number | null;
  unit: string | null;
  schedule_type: "daily" | "weekly" | "custom" | null;
  schedule_config: { weekdays?: number[] } | null;
  current_streak: number;
  completed_today: boolean;
  consistency_30d: number;
  scheduled_days_30d: number;
};

export type HabitEntry = { entry_date: string; status: "completed" | "skipped" | "missed" | "failed"; value: number | null };

export type NotePage = { id: string; title: string; icon: string | null; is_favorite: boolean; updated_at: string; created_at: string };
export type NoteBlock = { id?: string; block_type: string; content: { text?: string }; position?: number };

export type Transaction = {
  id: string;
  category_id: string | null;
  transaction_type: "income" | "expense";
  amount: number | string;
  currency: string;
  transaction_date: string;
  description: string;
};
export type Category = { id: string; name: string; category_type: "income" | "expense"; color: string };
export type Budget = {
  id: string;
  name: string;
  period_type: string;
  period_start: string;
  period_end: string;
  total_limit: number | string;
  currency: string;
  spent: number | string;
};
export type SavingsGoal = {
  id: string;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  currency: string;
  target_date: string | null;
  status: string;
};
export type FinanceSummary = { month: string; income: number | string; expenses: number | string; net: number | string };

export type Goal = {
  id: string;
  title: string;
  description: string;
  goal_type: string;
  target_value: number | string | null;
  current_value: number | string;
  unit: string | null;
  target_date: string | null;
  status: string;
};

export type CalendarEvent = { id: string; title: string; description: string; start_at: string; end_at: string };
export type SearchResult = { entity_type: "task" | "project" | "note" | "habit" | "goal"; id: string; title: string; detail: string };

export type Profile = {
  email: string | null;
  display_name: string | null;
  username: string | null;
  age: number | null;
  role: string | null;
  photo_url: string | null;
  timezone: string | null;
};

export type InsightDay = {
  day: string;
  tasks_completed: number;
  tasks_created: number;
  habits_done: number;
  income: number | string;
  expenses: number | string;
};
export type Insights = {
  days: number;
  series: InsightDay[];
  totals: { open_tasks: number; completed_tasks: number; overdue_tasks: number };
};
