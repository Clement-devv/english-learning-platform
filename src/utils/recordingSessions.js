// src/utils/recordingSessions.js
// Groups recordings into one entry per CLASS (booking). A class can hold
// several videos: the parts of a split recording (shared sessionId) and any
// separate recordings started during the same class (Record pressed again).
// Everything is ordered the way it was recorded, so "Part 1" is the start.

const bookingKey = (rec) => {
  const b = rec.bookingId;
  const id = b && typeof b === "object" ? b._id : b;
  return id ? `b:${id}` : `s:${rec.sessionId || rec._id}`;
};

const time = (d) => new Date(d || 0).getTime();

/**
 * @returns {Array<{ key, bookingId, parts, first, totalDuration, totalSize,
 *                   visibleToStudent, createdAt, classDate }>}
 *          newest class first; parts in recording order.
 */
export function groupRecordingSessions(recordings) {
  const classes = new Map();
  for (const rec of recordings) {
    const key = bookingKey(rec);
    if (!classes.has(key)) classes.set(key, []);
    classes.get(key).push(rec);
  }

  return Array.from(classes.entries()).map(([key, recs]) => {
    // Split into recording sessions (a legacy single file is its own session),
    // order sessions by when they started, parts by partNumber.
    const sessions = new Map();
    for (const r of recs) {
      const sk = r.sessionId || r._id;
      if (!sessions.has(sk)) sessions.set(sk, []);
      sessions.get(sk).push(r);
    }
    const parts = Array.from(sessions.values())
      .map(list => list.sort((a, b) => (a.partNumber || 1) - (b.partNumber || 1)))
      .sort((a, b) => Math.min(...a.map(r => time(r.createdAt))) - Math.min(...b.map(r => time(r.createdAt))))
      .flat();

    const first = parts[0];
    const b = first.bookingId && typeof first.bookingId === "object" ? first.bookingId : null;
    return {
      key,
      bookingId:        b?._id || (typeof first.bookingId === "string" ? first.bookingId : null),
      sessionId:        first.sessionId || null,
      parts,
      first,
      totalDuration:    parts.reduce((sum, p) => sum + (p.duration || 0), 0),
      totalSize:        parts.reduce((sum, p) => sum + (p.fileSize || 0), 0),
      visibleToStudent: parts.some(p => p.visibleToStudent),
      hasExternal:      parts.some(p => p.source === "external"),
      createdAt:        first.createdAt,
      // When the class took place (falls back to when it was recorded)
      classDate:        b?.scheduledTime || first.createdAt,
    };
  }).sort((a, b) => time(b.classDate) - time(a.classDate));
}

const clock = (d) => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const dur = (s) => {
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? (sec ? `${m}m ${sec}s` : `${m}m`) : `${sec}s`;
};

// ── External recording links (recorded in Zoom / Meet, link saved by teacher) ──

export const isExternal = (rec) => rec?.source === "external";

/** Friendly name for where a link points: "Zoom", "Google Drive", … */
export function linkSource(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.endsWith("zoom.us") || host.endsWith("zoom.com")) return "Zoom";
    if (host === "meet.google.com") return "Google Meet";
    if (host === "drive.google.com" || host === "docs.google.com") return "Google Drive";
    if (host.endsWith("dropbox.com")) return "Dropbox";
    if (host.endsWith("onedrive.live.com") || host.endsWith("sharepoint.com")) return "OneDrive";
    if (host.endsWith("youtube.com") || host === "youtu.be") return "YouTube";
    if (host.endsWith("loom.com")) return "Loom";
    return host;
  } catch {
    return "link";
  }
}

/** Open a saved link in a new tab without giving that page access to ours */
export function openExternal(url) {
  if (!/^https?:\/\//i.test(url || "")) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

/** "Part 2 · 10:08 AM · 7m 33s" (or "" when the class has one video) */
export function partLabel(rec, totalParts, index) {
  if (totalParts <= 1) return "";
  const n = index != null ? index + 1 : (rec.partNumber || 1);
  if (isExternal(rec)) {
    return `Part ${n} · 🔗 ${linkSource(rec.externalUrl)} link${rec.duration ? ` · ${dur(rec.duration)}` : ""}`;
  }
  const when = rec.createdAt ? ` · ${clock(time(rec.createdAt) - (rec.duration || 0) * 1000)}` : "";
  return `Part ${n}${when} · ${dur(rec.duration)}`;
}

/** Group classes under a day heading: [{ day: "Tue, Sep 30, 2026", classes: [...] }] */
export function groupByDay(classes) {
  const days = [];
  for (const c of classes) {
    const day = new Date(c.classDate).toLocaleDateString("en-US", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
    const last = days[days.length - 1];
    if (last && last.day === day) last.classes.push(c);
    else days.push({ day, classes: [c] });
  }
  return days;
}
