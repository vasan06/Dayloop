import { addDays, dayKey, isoDate, money, num } from "./format";
import type { FinanceSummary, InsightDay, Task } from "./types";

export const isOpen = (t: Task): boolean => t.status !== "completed" && t.status !== "cancelled";
export const isOverdue = (t: Task): boolean => isOpen(t) && t.due_at !== null && Date.parse(t.due_at) < Date.now();
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

export function spendingByCategory(summary: FinanceSummary | undefined, limit: number) {
  const entries = (summary?.spending_by_category ?? []).map(({ label, value }) => ({ label, value: num(value) }));
  if (entries.length <= limit) return entries;
  const visible = entries.slice(0, limit - 1);
  const remaining = entries.slice(limit - 1);
  return [...visible, { label: `Remaining (${remaining.length})`, value: remaining.reduce((sum, item) => sum + item.value, 0) }];
}

export const PALETTE = ["var(--acc)", "var(--amber)", "var(--green)", "var(--rose)", "var(--violet)", "var(--blue)"];

export function lastDays(n: number): Date[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export function largestTransaction(day: InsightDay, type: "income" | "expense") {
  const value = type === "income" ? day.largest_income : day.largest_expense;
  if (value == null) return "";
  const description = type === "income" ? day.income_description : day.expense_description;
  return `Largest ${type}: ${money(value)}${description ? " (" + description + ")" : ""}.`;
}
export const includesRecord = (name?: string | null) => name ? `Includes ${name}.` : "";
