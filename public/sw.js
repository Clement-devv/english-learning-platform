// public/sw.js — Service Worker: Push Notifications + Offline Caching

const CACHE_VERSION = "v1";
const SHELL_CACHE   = `shell-${CACHE_VERSION}`;
const STATIC_CACHE  = `static-${CACHE_VERSION}`;

// Core app shell routes to cache on install
const SHELL_URLS = ["/", "/offline.html"];

// ── Install: cache app shell ─────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: caching strategies ────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests on our own origin (or CDN assets)
  if (request.method !== "GET") return;

  // Skip API calls, socket connections, and Chrome extensions
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/socket.io/") ||
    url.protocol === "chrome-extension:"
  ) {
    return;
  }

  // ── Navigation (HTML pages): network-first, offline fallback ──────────────
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a fresh copy of the root for offline
          if (response.ok && url.pathname === "/") {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request) ||
          caches.match("/") ||
          caches.match("/offline.html")
        )
    );
    return;
  }

  // ── JS / CSS / Fonts / Images: cache-first (stale-while-revalidate) ───────
  const isStaticAsset = /\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|svg|ico|webp|avif|gif)(\?.*)?$/.test(
    url.pathname
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        // Return cached immediately; update cache in background
        return cached || networkFetch;
      })
    );
    return;
  }
});

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch (_) {}

  const title   = data.title ?? "English Platform";
  const options = {
    body:    data.body   ?? "",
    icon:    data.icon   ?? "/icons/icon.svg",
    badge:   data.badge  ?? "/icons/icon.svg",
    vibrate: [200, 100, 200],
    data:    data.data   ?? {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ───────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
