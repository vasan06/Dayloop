import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type AlertPermission = "granted" | "denied" | "default";
export const nativeAlerts = Capacitor.isNativePlatform();
export type NotificationSound = "dayloop" | "system" | "silent";
export function notificationSound(): NotificationSound {
  try {
    const value = localStorage.getItem("dayloop:notification-sound");
    return value === "system" || value === "silent" ? value : "dayloop";
  } catch { return "system"; }
}
export function setNotificationSound(value: NotificationSound): void {
  localStorage.setItem("dayloop:notification-sound", value);
}
async function soundSettings(): Promise<{ channelId?: string; sound?: string }> {
  const choice = notificationSound();
  if (!nativeAlerts) return {};
  if (choice === "system") {
    await LocalNotifications.createChannel({ id: "dayloop-system-v2", name: "DayLoop alerts", importance: 4 });
    return { channelId: "dayloop-system-v2" };
  }
  if (choice === "silent") {
    await LocalNotifications.createChannel({ id: "dayloop-silent-v1", name: "DayLoop silent", importance: 2 });
    return { channelId: "dayloop-silent-v1" };
  }
  // Android notification channel importance cannot be changed after creation;
  // use a new ID for heads-up alerts while retaining the existing chime.
  await LocalNotifications.createChannel({ id: "dayloop-chime-v2", name: "DayLoop reminders", importance: 4, sound: "dayloop_chime.wav" });
  return { channelId: "dayloop-chime-v2", sound: "dayloop_chime.wav" };
}

export async function alertPermission(): Promise<AlertPermission> {
  if (nativeAlerts) {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display === "granted" ? "granted" : status.display === "denied" ? "denied" : "default";
    } catch { return "denied"; }
  }
  return typeof Notification === "undefined" ? "denied" : Notification.permission;
}

export async function requestAlertPermission(): Promise<AlertPermission> {
  if (nativeAlerts) {
    const status = await LocalNotifications.requestPermissions();
    return status.display === "granted" ? "granted" : status.display === "denied" ? "denied" : "default";
  }
  if (typeof Notification === "undefined") return "denied";
  return Notification.requestPermission();
}

// Android notification IDs must be positive integers; stable IDs prevent duplicate scheduled reminders.
function alertId(key: string): number {
  let value = 2166136261;
  for (const ch of key) value = Math.imul(value ^ ch.charCodeAt(0), 16777619);
  return (value >>> 1) || 1;
}

export type AlertDestination = { sourceType?: "task" | "event" | "habit"; sourceId?: string; notificationId?: string; clickPath?: string };
export async function showAlert(title: string, body: string, key: string, target?: AlertDestination): Promise<void> {
  if (nativeAlerts) {
    const sound = await soundSettings();
    await LocalNotifications.schedule({
      // Omitting schedule delivers immediately through Android notification
      // manager, without requesting exact-alarm access for a banner.
      notifications: [{ id: alertId(key), title, body, ...sound, foreground: true,
        actionTypeId: target?.sourceType ? "dayloop-" + target.sourceType : undefined,
        extra: { dayloop: true, ...target } }],
    });
    return;
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") throw new Error("Notifications are not enabled");
  if ("serviceWorker" in navigator) {
    const worker = await navigator.serviceWorker.getRegistration("/");
    if (worker) {
      await worker.showNotification(title, { body, tag: key });
      return;
    }
  }
  new Notification(title, { body, tag: key });
}

export type UpcomingAlert = { key: string; title: string; body: string; when: number; notificationId?: string; sourceType?: "task" | "habit" | "event"; sourceId?: string };
export async function registerNotificationActions(onOpen: (path: string) => void): Promise<() => void> {
  if (!nativeAlerts) return () => {};
  await LocalNotifications.registerActionTypes({ types: [
    { id: "dayloop-task", actions: [
      { id: "complete", title: "Complete", foreground: true },
      { id: "reschedule", title: "Reschedule", foreground: true },
      { id: "clear", title: "Clear", foreground: true },
    ] },
    { id: "dayloop-event", actions: [
      { id: "complete", title: "Done", foreground: true },
      { id: "reschedule", title: "Reschedule", foreground: true },
      { id: "clear", title: "Clear", foreground: true },
    ] },
    { id: "dayloop-habit", actions: [
      { id: "complete", title: "Record", foreground: true },
      { id: "snooze", title: "Later", foreground: true },
      { id: "clear", title: "Clear", foreground: true },
    ] },
  ] });
  const obsolete = (await LocalNotifications.getPending()).notifications.filter(item => item.extra?.focus === true);
  if (obsolete.length) await LocalNotifications.cancel({ notifications: obsolete.map(({ id }) => ({ id })) });
  const listener = await LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
    const extra = notification.extra ?? {};
    if (extra.focus === true) return;
    const id = typeof extra.sourceId === "string" ? encodeURIComponent(extra.sourceId) : "";
    if (extra.sourceType === "task" && id) { onOpen("/tasks/" + id); return; }
    if (extra.sourceType === "project" && id) { onOpen("/projects/" + id); return; }
    if (extra.sourceType === "habit") { onOpen("/habits" + (id ? "?highlight=" + id : "")); return; }
    if (extra.sourceType === "event") { onOpen("/calendar" + (id ? "?highlight=" + id : "")); return; }
    if (typeof extra.clickPath === "string" && extra.clickPath.startsWith("/") && !extra.clickPath.startsWith("//")) onOpen(extra.clickPath);
  });
  return () => { void listener.remove(); };
}
export async function scheduleUpcomingAlerts(items: UpcomingAlert[]): Promise<void> {
  if (!nativeAlerts || await alertPermission() !== "granted") return;
  const now = Date.now();
  const future = items.filter((item) => Number.isFinite(item.when) && item.when > now + 1000 && item.when <= now + 30 * 86400000)
    .sort((a, b) => a.when - b.when).slice(0, 50);
  const ids = future.map((item) => alertId(item.key));
  const previous = await LocalNotifications.getPending();
  // Do not cancel focus timers/alarms when refreshing task/event reminders.
  const managed = previous.notifications.filter((notification) => notification.extra?.scheduledByDayLoop === true);
  const stale = managed.filter((notification) => !ids.includes(notification.id));
  if (stale.length) await LocalNotifications.cancel({ notifications: stale.map(({ id }) => ({ id })) });
  if (!future.length) return;
  const sound = await soundSettings();
  await LocalNotifications.schedule({
    notifications: future.map(({ key, title, body, when, notificationId, sourceType, sourceId }) => ({
      id: alertId(key), title, body, ...sound, foreground: true,
      actionTypeId: sourceType ? `dayloop-${sourceType}` : undefined,
      extra: { dayloop: true, scheduledByDayLoop: true, notificationId, sourceType, sourceId }, schedule: { at: new Date(when), allowWhileIdle: true },
      isExactNotification: false,
    })),
  });
}

export async function scheduleHabitSnooze(habitId: string, at: number): Promise<void> {
  if (!nativeAlerts) throw new Error("Background snooze is available in the Android app.");
  if (await alertPermission() !== "granted") throw new Error("Enable DayLoop notifications before snoozing.");
  const sound = await soundSettings();
  await LocalNotifications.schedule({ notifications: [{
    id: alertId(`habit-snooze:${habitId}`), title: "Habit reminder", body: "Your DayLoop habit needs attention.",
    ...sound, foreground: true, actionTypeId: "dayloop-habit",
    extra: { dayloop: true, sourceType: "habit", sourceId: habitId },
    schedule: { at: new Date(at), allowWhileIdle: true }, isExactNotification: false,
  }] });
}

export type DeadlinePreferences = { before: number; after: number };
export function deadlinePreferences(): DeadlinePreferences {
  try {
    const raw = JSON.parse(localStorage.getItem("dayloop:deadline-preferences") || "{}");
    const allowed = [0, 5, 15, 30, 60, 120, 1440];
    return { before: allowed.includes(raw.before) ? raw.before : 60, after: allowed.includes(raw.after) ? raw.after : 30 };
  } catch { return { before: 60, after: 30 }; }
}
export function setDeadlinePreferences(value: DeadlinePreferences) {
  localStorage.setItem("dayloop:deadline-preferences", JSON.stringify(value));
  window.dispatchEvent(new Event("dayloop:deadline-preferences"));
}
export function taskDeadlineAlerts(task: {id:string;title:string;due_at?:string|null}, prefs:DeadlinePreferences): UpcomingAlert[] {
  const due = Date.parse(task.due_at || "");
  if (!Number.isFinite(due)) return [];
  const base = { body: task.title, sourceType: "task" as const, sourceId: task.id };
  return [
    ...(prefs.before ? [{ ...base, key: `task:${task.id}:${due}:before`, title: "Task deadline approaching", when: due - prefs.before * 60000 }] : []),
    { ...base, key: `task:${task.id}:${due}:due`, title: "Task due now", when: due },
    ...(prefs.after ? [{ ...base, key: `task:${task.id}:${due}:after`, title: "Task overdue", when: due + prefs.after * 60000 }] : []),
  ];
}
