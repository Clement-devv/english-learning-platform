// src/pages/admin/modals/StudentNotifyModal.jsx
// Admin: a student's notification settings + "remind to join" button.
//  • Managed students: optional notification email (never a login).
//  • Online students: reminders go to their account email.
//  • Switch: may this student's teachers send join reminders? (teachers never see the address)
// Server: routes/studentRoutes.js (/:id/notify-settings, /:id/join-reminder), utils/joinReminder.js
import { useEffect, useState } from "react";
import { X, Mail, BellRing, Send, Loader2 } from "lucide-react";
import api from "../../../api";

const BRAND = "var(--brand-primary, #2563eb)";
const fmtWhen = (d) => new Date(d).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function StudentNotifyModal({ student, isDarkMode, onClose, notify }) {
  const [settings, setSettings] = useState(null);
  const [email, setEmail]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState("");

  const c = isDarkMode
    ? { card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#8b91b8", input: "#0f1117", soft: "#141620" }
    : { card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#475569", muted: "#94a3b8", input: "#f8faff", soft: "#f8fafc" };

  const load = () => api.get(`/students/${student._id}/notify-settings`)
    .then(({ data }) => { setSettings(data.settings); setEmail(data.settings.notifyEmail || ""); })
    .catch(() => setError("Could not load settings"));
  useEffect(() => { load(); }, [student._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (patch) => {
    setSaving(true); setError("");
    try {
      const { data } = await api.patch(`/students/${student._id}/notify-settings`, patch);
      setSettings(s => ({ ...s, ...data.settings, reminderEmail: s.isManaged ? data.settings.notifyEmail : s.reminderEmail }));
      notify?.(data.message || "Saved");
    } catch (err) { setError(err?.response?.data?.message || "Could not save"); }
    finally { setSaving(false); }
  };

  const remind = async () => {
    setSending(true); setError("");
    try {
      const { data } = await api.post(`/students/${student._id}/join-reminder`);
      notify?.(data.message || "Reminder sent");
    } catch (err) { setError(err?.response?.data?.message || "Could not send the reminder"); }
    finally { setSending(false); }
  };

  const name = `${student.firstName || ""} ${student.lastName || ""}`.trim();
  const inp = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.input, color: c.heading, fontSize: 14, fontFamily: "inherit" };
  const btn = (primary) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    border: primary ? "none" : `1px solid ${c.border}`, background: primary ? BRAND : "transparent", color: primary ? "#fff" : c.heading });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Notifications and reminders"
        style={{ background: c.card, borderRadius: 18, width: "100%", maxWidth: 460, padding: 20, display: "flex", flexDirection: "column", gap: 14, border: `1px solid ${c.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: c.heading, display: "flex", alignItems: "center", gap: 8 }}><BellRing size={18} color={BRAND} /> Notifications & reminders</div>
            <div style={{ fontSize: 12.5, color: c.body }}>{name}{student.isManaged ? " · Managed student" : ""}</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ ...btn(false), padding: 6 }}><X size={15} /></button>
        </div>

        {!settings ? (
          <p style={{ color: c.muted, textAlign: "center", padding: 20 }}>{error || "Loading…"}</p>
        ) : (
          <>
            {/* Where reminders go */}
            {settings.isManaged ? (
              <div>
                <label htmlFor="notify-email" style={{ fontSize: 12, fontWeight: 800, color: c.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Notification email <span style={{ textTransform: "none", fontWeight: 500 }}>(optional — not a login)</span>
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input id="notify-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@example.com" style={inp} />
                  <button type="button" disabled={saving || email.trim() === (settings.notifyEmail || "")} onClick={() => save({ notifyEmail: email.trim() })}
                    style={{ ...btn(true), opacity: saving || email.trim() === (settings.notifyEmail || "") ? 0.6 : 1 }}>Save</button>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: c.muted }}>Used only to send this student notifications such as "your class is starting". Teachers can't see it.</p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: c.body, padding: "10px 12px", borderRadius: 10, background: c.soft }}>
                <Mail size={14} /> Reminders go to the student's account email{settings.reminderEmail ? <strong style={{ color: c.heading }}>&nbsp;{settings.reminderEmail}</strong> : null}.
              </div>
            )}

            {/* Teacher switch */}
            <label style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 12, border: `1px solid ${c.border}`, cursor: "pointer" }}>
              <input type="checkbox" checked={settings.joinReminderTeacherAllowed} disabled={saving}
                onChange={e => save({ joinReminderTeacherAllowed: e.target.checked })} style={{ width: 18, height: 18 }} />
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: c.heading }}>Teachers can send join reminders</span>
                <span style={{ display: "block", fontSize: 12, color: c.muted }}>Shows a "Remind to join" button on the teacher's class. The teacher never sees the email address.</span>
              </span>
            </label>

            {/* Remind now */}
            <div style={{ padding: "12px 14px", borderRadius: 12, background: c.soft, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, color: c.body }}>
                {settings.currentClass
                  ? <>Class now: <strong style={{ color: c.heading }}>{settings.currentClass.title}</strong> · {fmtWhen(settings.currentClass.scheduledTime)}</>
                  : "No class right now — reminders can be sent from 30 minutes before a class until it ends."}
              </div>
              <button type="button" onClick={remind} disabled={sending || !settings.currentClass || !settings.reminderEmail}
                style={{ ...btn(true), alignSelf: "flex-start", opacity: sending || !settings.currentClass || !settings.reminderEmail ? 0.55 : 1 }}>
                {sending ? <Loader2 size={14} /> : <Send size={14} />} Send "join your class now" email
              </button>
              {!settings.reminderEmail && <span style={{ fontSize: 12, color: "#b45309" }}>Add a notification email first.</span>}
            </div>
          </>
        )}
        {error && settings && <p role="alert" style={{ margin: 0, padding: "8px 12px", borderRadius: 10, background: "#fee2e2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>{error}</p>}
      </div>
    </div>
  );
}
