import { addDays, dayKey, isoDate, num } from "./format";
import type { Category, Task, Transaction } from "./types";

export const isOpen = (t: Task): boolean => t.status !== "completed" && t.status !== "cancelled";
export const isOverdue = (t: Task): boolean => isOpen(t) && Boolean(t.due_at) && new Date(t.due_at as string) < new Date(new Date().setHours(0, 0, 0, 0));
export const isToday = (t: Task): boolean => isOpen(t) && dayKey(t.due_at) === isoDate();

/** Task completion percentage per project id. */
export function projectProgress(tasks: Task[]): Map<string, { done: number; total: number }> {
  const map = new Map<string, { done: number; total: number }>();
  for (const t of tasks) {
    if (!t.project_id || t.parent_task_id || t.status === "cancelled") continue;
    const entry = map.get(t.project_id) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (t.status === "completed") entry.done += 1;
    map.set(t.project_id, entry);
  }
  return map;
}

export function spendingByCategory(transactions: Transaction[], categories: Category[], month = isoDate().slice(0, 7)) {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.transaction_type !== "expense" || !t.transaction_date.startsWith(month)) continue;
    const key = (t.category_id && names.get(t.category_id)) || "Uncategorised";
    totals.set(key, (totals.get(key) ?? 0) + num(t.amount));
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export const PALETTE = ["var(--acc)", "var(--amber)", "var(--green)", "var(--rose)", "var(--violet)", "var(--blue)"];

export function lastDays(n: number): Date[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}
