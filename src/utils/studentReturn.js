// src/utils/studentReturn.js
// Where a student goes after logging in, when they opened a page that needed a
// login first (a Word Squad game link from their teacher). Only game pages are
// remembered, so this can't be used to send someone elsewhere.
const KEY = 'studentReturnTo';
const ALLOWED = /^\/student\/games\/[\w-]+(\?[\w=&-]*)?$/;

export function saveStudentReturn(path) {
  if (!ALLOWED.test(path)) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* storage unavailable */ }
}

export function takeStudentReturn() {
  let path = null;
  try { path = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  return path && ALLOWED.test(path) ? path : null;
}
