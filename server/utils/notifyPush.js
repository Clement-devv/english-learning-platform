// server/utils/notifyPush.js
// Phone / desktop pop-ups (web push) for events, in one shape: title, short body, a `tag`
// (one pop-up per thing — the dashboard's own notification for the same event uses the
// same tag, src/utils/localNotify.js) and the dashboard tab to open when clicked.
// Only signed-in devices that allowed notifications receive them (webPushService.js).
// Fire-and-forget: never throws, never slows the request.
import { pushToUser, pushToAllAdmins } from "./webPushService.js";

const payload = (title, body, { tag, url }) => ({
  title,
  body: String(body || "").slice(0, 140),
  icon: "/icons/icon.svg",
  ...(tag ? { tag } : {}),
  data: { url },
});
const tabUrl = (base, tab) => (tab ? `${base}?tab=${encodeURIComponent(tab)}` : base);

export const pushTeacher = (db, teacherId, title, body, { tag, tab } = {}) =>
  teacherId && pushToUser(db, "teacher", teacherId?._id || teacherId, payload(title, body, { tag, url: tabUrl("/teacher/dashboard", tab) }));

export const pushStudent = (db, studentId, title, body, { tag, tab } = {}) =>
  studentId && pushToUser(db, "student", studentId?._id || studentId, payload(title, body, { tag, url: tabUrl("/student/dashboard", tab) }));

export const pushAdmins = (db, title, body, { tag, tab } = {}) =>
  pushToAllAdmins(db, payload(title, body, { tag, url: tabUrl("/admin", tab) }));
