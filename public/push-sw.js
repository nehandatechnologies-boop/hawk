/* HAWKTRACE web-push service worker.
 * Messaging worker only — it does NOT cache or serve app assets.
 * Receives Web Push messages so operators are alerted even when the
 * dashboard tab is closed. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "HAWKTRACE alert", body: event.data ? event.data.text() : "" };
  }

  const priority = payload.priority || "Medium";
  const title = payload.title || `${priority} sighting match`;
  const body = payload.body || "New detection on the HAWKTRACE network.";
  const critical = priority === "Critical" || priority === "High";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload.tag || `hawktrace-${payload.alertId || Date.now()}`,
      renotify: true,
      requireInteraction: critical,
      silent: false,
      badge: "/favicon.ico",
      icon: "/favicon.ico",
      timestamp: Date.now(),
      vibrate: critical ? [200, 100, 200, 100, 400] : [150],
      data: { url: payload.url || "/alerts", alertId: payload.alertId || null },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/alerts";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
