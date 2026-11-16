export const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const money = (value: unknown, currency = "INR"): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(num(value));

export const compact = (value: unknown): string =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(num(value));

/** Local calendar date as YYYY-MM-DD (never shifted by UTC). */
export const isoDate = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const dayKey = (value: string | null | undefined): string => (value ? isoDate(new Date(value)) : "");

export const shortDate = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleDateString("en", { day: "numeric", month: "short" }) : "No date";

export const timeOf = (value: string): string =>
  new Date(value).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });

export const relative = (value: string): string => {
  const diff = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  const abs = Math.abs(diff);
  const text = abs < 60 ? `${abs}m` : abs < 1440 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`;
  return diff < 0 ? `${text} ago` : `in ${text}`;
};

export const greeting = (): string => {
  const hour = new Date().getHours();
  return hour < 5 ? "Burning the midnight oil" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "DL";

export const priorityLabel = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" } as const;
export const statusLabel = {
  inbox: "Inbox",
  not_started: "To do",
  in_progress: "In progress",
  waiting: "Waiting",
  completed: "Done",
  cancelled: "Cancelled",
} as const;

export const PROJECT_TONES = ["butter", "mint", "sky", "blush", "lilac"] as const;
export const toneOf = (key: string): (typeof PROJECT_TONES)[number] => {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PROJECT_TONES[hash % PROJECT_TONES.length];
};
