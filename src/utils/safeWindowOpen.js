// Links the app opens with window.open (teachers' Meet / Zoom links, class links…) come from
// the database. The server only accepts https meeting links now, but a javascript: / data:
// URL saved earlier would run script in our origin (and could read the session token) —
// so window.open refuses anything that isn't http(s), mail, phone, a blob or this site.
const SAFE_SCHEME = /^(https?:|mailto:|tel:|blob:)/i;

export function isSafeUrl(url) {
  const s = String(url ?? '').trim();
  if (SAFE_SCHEME.test(s) || s === 'about:blank') return true;
  try { return new URL(s, window.location.href).origin === window.location.origin; } catch { return false; }
}

export function installSafeWindowOpen() {
  if (window.__safeOpenInstalled) return;
  window.__safeOpenInstalled = true;
  const nativeOpen = window.open.bind(window);
  window.open = (url, ...rest) => {
    if (url == null || url === '' || isSafeUrl(url)) return nativeOpen(url, ...rest);
    console.warn('Blocked an unsafe link');
    return null;
  };
}
