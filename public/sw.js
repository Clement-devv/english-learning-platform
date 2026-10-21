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
  // Only cache same-origin assets — skip third-party URLs (Google Translate,
  // external analytics, etc.) to avoid unhandled rejections when they're offline.
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticAsset = isSameOrigin && /\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|svg|ico|webp|avif|gif)(\?.*)?$/.test(
    url.pathname
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached || Response.error());
        // Return cached immediately; update cache in background
        return cached || networkFetch;
      })
    );
    return;
  }
});

// ── Push Notifications ───────────────────────────────────────────────────────
// Shown when the app is in a background tab, minimised or closed. When the person is
// looking at an app tab right now, that page already shows it (toast / badge), so no
// system pop-up. `tag` (set by the server per event) makes the page's own notification
// for the same event replace this one instead of doubling it (src/utils/localNotify.js).
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
    ...(data.tag ? { tag: data.tag, renotify: !!data.renotify } : {}),
  };

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const watching = list.some((c) => c.focused && c.visibilityState === "visible");
      if (watching) return undefined;
      return self.registration.showNotification(title, options);
    })
  );
});

// ── Notification Click ───────────────────────────────────────────────────────
// Opens the page the notification is about. Only links on this site are followed.
// An app tab that's already open is reused: it's focused and told where to go
// (src/main.jsx listens for "notification-click"), instead of opening another tab.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL("/", self.location.origin);
  try {
    const u = new URL(event.notification.data?.url ?? "/", self.location.origin);
    if (u.origin === self.location.origin) target = u;
  } catch (_) { /* keep "/" */ }
  const url = target.pathname + target.search + target.hash;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const same = list.find((c) => new URL(c.url).pathname === target.pathname) || list[0];
        if (same && "focus" in same) {
          same.postMessage({ type: "notification-click", url });
          return same.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
        return undefined;
      })
  );
});
