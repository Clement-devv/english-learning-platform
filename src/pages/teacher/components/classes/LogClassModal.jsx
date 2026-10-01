// src/pages/teacher/components/classes/LogClassModal.jsx
// Teacher logs a class that happened outside the app (site down, held directly on
// Google Meet / Zoom…). It waits for admin approval before any pay is added.
// Server: server/routes/offlineClassRoutes.js
import { useState } from "react";
import { X, Link2, Info } from "lucide-react";
import api from "../../../../api";
import ManagedBadge from "../../../../components/ManagedBadge";

const BRAND  = "var(--brand-primary, #2563eb)";
const brandA = (a) => `rgba(var(--brand-primary-rgb, 37, 99, 235), ${a})`;

const REASONS = [
  "The app/website was down",
  "Classroom page wouldn't load",
  "Held directly on Google Meet / Zoom",
  "Other",
];
const MAX_AGE_DAYS = 14;

// <input type="datetime-local"> value in the user's local time
const toLocalInput = (d) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

export default function LogClassModal({ isOpen, onClose, onLogged, students = [], isDarkMode }) {
  const [form, setForm] = useState({
    studentId: "", classTitle: "", topic: "", when: "", duration: "60",
    platform: "googlemeet", reasonPick: REASONS[2], reasonText: "", recordingUrl: "", recordingNote: "",
  });
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");
  if (!isOpen) return null;

  const c = isDarkMode
    ? { card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#8b91b8", input: "#0f1117" }
    : { card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#475569", muted: "#94a3b8", input: "#f8faff" };
  const inp = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.input, color: c.heading, fontSize: 14, fontFamily: "inherit", colorScheme: isDarkMode ? "dark" : "light" };
  const lbl = { display: "block", fontSize: 12, fontWeight: 800, color: c.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 };
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const now = new Date();
  const minWhen = toLocalInput(new Date(now.getTime() - MAX_AGE_DAYS * 86400000));
  const maxWhen = toLocalInput(now);
  const selected = students.find(s => (s._id || s.id) === form.studentId);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const reason = form.reasonPick === "Other" ? form.reasonText.trim() : `${form.reasonPick}${form.reasonText.trim() ? ` — ${form.reasonText.trim()}` : ""}`;
    if (!reason) { setError("Please say why the class wasn't held in the app"); return; }
    setBusy(true);
    try {
      await api.post("/offline-classes", {
        studentId: form.studentId, classTitle: form.classTitle.trim(), topic: form.topic.trim(),
        scheduledTime: new Date(form.when).toISOString(), duration: parseInt(form.duration, 10),
        platform: form.platform, reason,
        recordingUrl: form.recordingUrl.trim(), recordingNote: form.recordingNote.trim(),
      });
      onLogged?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not log the class. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} role="dialog" aria-label="Log a class held outside the app"
        style={{ background: c.card, border: `1.5px solid ${c.border}`, borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: c.heading }}>Log a class held outside the app</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: c.muted }}>For classes that really happened but weren't tracked here</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, display: "flex" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 12, background: isDarkMode ? "rgba(245,158,11,.12)" : "#fffbeb", border: `1px solid ${isDarkMode ? "rgba(245,158,11,.35)" : "#fde68a"}` }}>
            <Info size={16} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: isDarkMode ? "#fcd34d" : "#92400e", lineHeight: 1.55 }}>
              Your admin reviews it before anything is paid. {selected?.isManaged ? "The parent will also be asked to confirm." : "The student will also be asked to confirm."} A recording link helps it get approved faster.
            </p>
          </div>

          <div>
            <label style={lbl} htmlFor="lc-student">Student *</label>
            <select id="lc-student" value={form.studentId} onChange={set("studentId")} required style={inp}>
              <option value="">Select student…</option>
              {students.map(s => (
                <option key={s._id || s.id} value={s._id || s.id}>{s.firstName} {s.lastName}{s.isManaged ? " · Managed" : ""}</option>
              ))}
            </select>
            {selected?.isManaged && <div style={{ marginTop: 6 }}><ManagedBadge isDarkMode={isDarkMode} /></div>}
          </div>

          <div>
            <label style={lbl} htmlFor="lc-title">Class title *</label>
            <input id="lc-title" value={form.classTitle} onChange={set("classTitle")} required maxLength={200} placeholder="e.g. Speaking practice" style={inp} />
          </div>
          <div>
            <label style={lbl} htmlFor="lc-topic">Topic</label>
            <input id="lc-topic" value={form.topic} onChange={set("topic")} maxLength={500} placeholder="e.g. Past simple" style={inp} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={lbl} htmlFor="lc-when">When it started *</label>
              <input id="lc-when" type="datetime-local" value={form.when} onChange={set("when")} required min={minWhen} max={maxWhen} style={inp} />
            </div>
            <div>
              <label style={lbl} htmlFor="lc-dur">Duration *</label>
              <select id="lc-dur" value={form.duration} onChange={set("duration")} style={inp}>
                {[15, 30, 45, 60, 90, 120, 180].map(m => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={lbl} htmlFor="lc-platform">Where *</label>
              <select id="lc-platform" value={form.platform} onChange={set("platform")} style={inp}>
                <option value="googlemeet">Google Meet</option>
                <option value="zoom">Zoom</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={lbl} htmlFor="lc-reason">Why not in the app *</label>
              <select id="lc-reason" value={form.reasonPick} onChange={set("reasonPick")} style={inp}>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl} htmlFor="lc-reason-text">{form.reasonPick === "Other" ? "Explain *" : "More details (optional)"}</label>
            <input id="lc-reason-text" value={form.reasonText} onChange={set("reasonText")} maxLength={300} required={form.reasonPick === "Other"}
              placeholder="e.g. Site showed an error from 5pm to 6pm" style={inp} />
          </div>

          <div style={{ padding: 14, borderRadius: 12, background: brandA(0.06), border: `1px solid ${brandA(0.25)}` }}>
            <label style={{ ...lbl, color: BRAND, display: "flex", alignItems: "center", gap: 6 }} htmlFor="lc-rec"><Link2 size={13} /> Recording link (recommended)</label>
            <input id="lc-rec" type="url" value={form.recordingUrl} onChange={set("recordingUrl")} placeholder="https://drive.google.com/… or Zoom cloud link" style={inp} />
            <input value={form.recordingNote} onChange={set("recordingNote")} maxLength={300} placeholder="Note for your admin (optional)" style={{ ...inp, marginTop: 8 }} aria-label="Recording note" />
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: c.muted }}>Make sure the link can be opened by your admin. You can also add it later in Recordings → Add link.</p>
          </div>

          {error && <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "#fee2e2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>{error}</p>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: "transparent", color: c.body, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button type="submit" disabled={busy} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? .7 : 1, fontFamily: "inherit" }}>
              {busy ? "Sending…" : "Send for approval"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
