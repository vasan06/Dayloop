import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type AlertPermission = "granted" | "denied" | "default";
export const nativeAlerts = Capacitor.isNativePlatform();

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

export async function showAlert(title: string, body: string, key: string): Promise<void> {
  if (nativeAlerts) {
    await LocalNotifications.schedule({
      notifications: [{ id: alertId(key), title, body, schedule: { at: new Date(Date.now() + 250) } }],
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

export type UpcomingAlert = { key: string; title: string; body: string; when: number };
export async function scheduleUpcomingAlerts(items: UpcomingAlert[]): Promise<void> {
  if (!nativeAlerts || await alertPermission() !== "granted") return;
  const now = Date.now();
  const future = items.filter((item) => Number.isFinite(item.when) && item.when > now + 1000 && item.when <= now + 30 * 86400000).slice(0, 50);
  const ids = future.map((item) => alertId(item.key));
  const previous = await LocalNotifications.getPending();
  const managed = previous.notifications.filter((notification) => notification.extra?.dayloop === true);
  const stale = managed.filter((notification) => !ids.includes(notification.id));
  if (stale.length) await LocalNotifications.cancel({ notifications: stale.map(({ id }) => ({ id })) });
  if (!future.length) return;
  await LocalNotifications.schedule({
    notifications: future.map(({ key, title, body, when }) => ({
      id: alertId(key), title, body, extra: { dayloop: true }, schedule: { at: new Date(when) },
    })),
  });
}
