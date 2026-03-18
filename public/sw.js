// public/sw.js — Service Worker for Web Push notifications

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch (_) {}

  const title   = data.title ?? "English Platform";
  const options = {
    body:    data.body   ?? "",
    icon:    data.icon   ?? "/favicon.ico",
    badge:   data.badge  ?? "/favicon.ico",
    vibrate: [200, 100, 200],
    data:    data.data   ?? {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        // Focus existing tab if open
        for (const client of list) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
