// server/middleware/requestMonitor.js
// Watches the platform's main actions for the super admin's App Health tab.
//
//  • Every request runs inside requestContext, so anything it does later (like
//    sending an email) knows which center it belongs to.
//  • The actions in WATCH are recorded when they finish: who, which center,
//    worked or not, and the HTTP status. 4xx = the person had a problem
//    (wrong password, slot taken…); 5xx = the platform failed.
//  • Any other request that ends in a 5xx is recorded as a server error.
// Nothing here ever delays or fails a request.
import { requestContext, recordEvent, emailActor } from "../utils/monitor.js";

// [method, path (after /api/v1), kind, action]
const WATCH = [
  ["POST",  /^\/auth\/(teacher|student|admin)\/login$/,           "login",    "login"],
  ["POST",  /^\/sub-admin-auth\/login$/,                          "login",    "login"],
  ["POST",  /^\/auth\/verify-2fa-login$/,                         "login",    "login-2fa"],
  ["POST",  /^\/(auth\/(teacher|student|admin)|sub-admin-auth)\/forgot-password$/, "login", "forgot-password"],
  ["POST",  /^\/(auth\/(teacher|student|admin)|sub-admin-auth)\/reset-password\//, "login", "reset-password"],
  ["POST",  /^\/bookings\/?$/,                                    "booking",  "booking-create"],
  ["POST",  /^\/bookings\/student-request$/,                      "booking",  "booking-request"],
  ["PATCH", /^\/bookings\/[^/]+\/accept$/,                        "booking",  "booking-accept"],
  ["PATCH", /^\/bookings\/[^/]+\/reject$/,                        "booking",  "booking-reject"],
  ["PATCH", /^\/bookings\/[^/]+\/cancel$/,                        "booking",  "booking-cancel"],
  ["POST",  /^\/recurring-bookings\/?$/,                          "booking",  "recurring-create"],
  ["POST",  /^\/group-classes\/[^/]+\/enroll$/,                   "booking",  "group-enroll"],
  ["GET",   /^\/agora\/token$/,                                   "class",    "class-join"],
  ["GET",   /^\/classroom\/session\/[^/]+$/,                      "class",    "class-open"],
  ["POST",  /^\/classroom\/attendance$/,                          "class",    "class-attendance"],
  ["PATCH", /^\/bookings\/[^/]+\/complete$/,                      "class",    "class-complete"],
  ["POST",  /^\/bookings\/[^/]+\/join-reminder$/,                 "class",    "join-reminder"],
  ["POST",  /^\/students\/[^/]+\/join-reminder$/,                 "class",    "join-reminder"],
  ["PATCH", /^\/group-classes\/[^/]+\/(start|complete)$/,         "class",    "group-class"],
  ["POST",  /^\/homework\/?$/,                                    "learning", "homework-create"],
  ["POST",  /^\/homework\/[^/]+\/submit$/,                        "learning", "homework-submit"],
  ["POST",  /^\/homework\/link\/[^/]+\/submit$/,                  "learning", "homework-link-submit"],
  ["POST",  /^\/quiz\/?$/,                                        "learning", "quiz-create"],
  ["POST",  /^\/quiz\/[^/]+\/attempt$/,                           "learning", "quiz-attempt"],
  ["POST",  /^\/quiz\/link\/[^/]+\/submit$/,                      "learning", "quiz-link-submit"],
  ["PUT",   /^\/class-summaries\/(group\/)?[^/]+$/,               "learning", "class-summary"],
  ["PATCH", /^\/payment-transactions\/[^/]+\/pay$/,               "payment",  "teacher-payout"],
  ["PATCH", /^\/payment-transactions\/teacher\/[^/]+\/pay-all$/,  "payment",  "teacher-payout"],
  ["POST",  /^\/payment-transactions\/manual$/,                   "payment",  "manual-payment"],
  ["POST",  /^\/students\/[^/]+\/payment$/,                       "payment",  "student-payment"],
];

const match = (method, path) => {
  for (const [m, re, kind, action] of WATCH) if (m === method && re.test(path)) return { kind, action };
  return null;
};

/** The person behind a request: the signed-in user, or the email typed into a login form. */
function actorOf(req, kind, path) {
  const u = req.user;
  if (u?.id && u.role !== "superadmin") return { id: String(u.id), role: u.role || null };
  if (kind === "login") {
    const email = typeof req.body?.email === "string" ? req.body.email : null;
    const role = (path.match(/\/auth\/(teacher|student|admin)\//) || [])[1] || (path.includes("sub-admin") ? "subadmin" : null);
    return emailActor(email, role);
  }
  return undefined;
}

export function requestMonitor(req, res, next) {
  const started = Date.now();
  // Routers rewrite req.url as they go — keep the original
  const path = req.path.replace(/^\/v1(?=\/)/, "");
  // Keep the error message the route sent back ("This slot is taken"…)
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && body && typeof body.message === "string") res.locals.monitorMsg = body.message;
    return json(body);
  };
  res.on("finish", () => {
    try {
      if (path.startsWith("/health") || path.startsWith("/client-errors")) return;
      const status = res.statusCode;
      const hit = match(req.method, path);
      if (!hit && status < 500) return;
      // Expired sessions / missing tokens are normal — not a difficulty
      if (hit && hit.kind !== "login" && status === 401) return;
      // Unknown/inactive center (bad link, old bookmark) — not about a real person
      if (hit && !req.center && status < 500) return;
      const ok = status < 400;
      recordEvent({
        kind: hit ? hit.kind : "request",
        action: hit ? hit.action : `${req.method} ${path.replace(/[0-9a-f]{24}/gi, ":id").replace(/\/[A-Za-z0-9_-]{32,}/g, "/:token").slice(0, 70)}`,
        ok,
        status,
        msg: ok ? "" : (res.locals?.monitorMsg || ""),
        center: req.center?.slug || null,
        actor: actorOf(req, hit?.kind, path),
        meta: { ms: Date.now() - started },
      });
    } catch { /* never break a response */ }
  });
  requestContext.run({ center: null }, () => next());
}

/** Tag the request's center as soon as it's known (called by tenantMiddleware). */
export function setRequestCenter(slug) {
  const store = requestContext.getStore();
  if (store) store.center = slug;
}
