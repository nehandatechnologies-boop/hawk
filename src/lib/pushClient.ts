/**
 * Client-side notification plumbing.
 *
 * Two independent layers:
 *  1. Foreground OS notifications via the Notification API (works while a tab
 *     is open, even if it isn't focused).
 *  2. Web Push via the `/push-sw.js` messaging service worker, so operators
 *     get OS-level alerts with the dashboard closed.
 */

const SW_URL = "/push-sw.js";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Show an OS notification for a live detection (foreground path). */
export function showAlertNotification(input: {
  priority: string;
  title: string;
  body: string;
  alertId?: string | null;
}) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(`${input.priority.toUpperCase()} · ${input.title}`, {
      body: input.body,
      tag: `hawktrace-${input.alertId ?? Date.now()}`,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      requireInteraction: input.priority === "Critical",
    });
    n.onclick = () => {
      window.focus();
      window.location.assign("/alerts");
      n.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker; the push
    // channel covers that case.
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function registerWorker() {
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Subscribe this device for Web Push. Returns the raw subscription payload. */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<{ endpoint: string; p256dh: string; auth: string } | null> {
  if (!pushSupported()) return null;
  const permission = await requestNotificationPermission();
  if (permission !== "granted") return null;

  const reg = await registerWorker();
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const json = sub.toJSON();
  const p256dh = json.keys?.["p256dh"];
  const auth = json.keys?.["auth"];
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth };
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const sub = await getExistingPushSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
  return endpoint;
}
