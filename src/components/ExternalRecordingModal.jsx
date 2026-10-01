// src/components/ExternalRecordingModal.jsx
// Teacher saves a recording that was made outside our app (Zoom / Google Meet
// cloud recording) by pasting its share link against a class. Admins can open
// the link to confirm the class happened. Also used to edit a saved link.
import { useState, useEffect, useMemo } from "react";
import { X, Link2, Loader2 } from "lucide-react";
import api from "../api";

const fmtClass = (c) => {
  const d = new Date(c.scheduledTime);
  const date = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const who  = c.studentId ? `${c.studentId.firstName || ""} ${c.studentId.lastName || ""}`.trim() : "";
  return `${c.classTitle} — ${date} · ${time}${who ? ` (${who})` : ""}`;
};

export default function ExternalRecordingModal({ isDarkMode, studentId = null, editing = null, onClose, onSaved }) {
  const isEdit = !!editing;
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(!isEdit);
  const [student,  setStudent]  = useState(studentId || "");
  const [bookingId, setBookingId] = useState("");
  const [url,      setUrl]      = useState(editing?.externalUrl || "");
  const [note,     setNote]     = useState(editing?.note || "");
  const [minutes,  setMinutes]  = useState(editing?.duration ? String(Math.round(editing.duration / 60)) : "");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const col = {
    card:   isDarkMode ? "#1a1d2e" : "#ffffff",
    border: isDarkMode ? "#2a2d40" : "#e8edf5",
    text:   isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:  isDarkMode ? "#8b91b8" : "#6b7280",
    input:  isDarkMode ? "#1e2235" : "#f3f4f6",
    accent: "#6366f1",
  };

  useEffect(() => {
    if (isEdit) return;
    api.get("/recordings/classes-for-link")
      .then(r => setClasses(r.data?.data || []))
      .catch(() => setError("Could not load your classes. Please try again."))
      .finally(() => setLoading(false));
  }, [isEdit]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const students = useMemo(() => {
    const map = new Map();
    for (const c of classes) {
      const s = c.studentId;
      if (s?._id && !map.has(s._id)) map.set(s._id, `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Student");
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [classes]);

  const visibleClasses = useMemo(
    () => student ? classes.filter(c => c.studentId?._id === student) : classes,
    [classes, student],
  );

  // Keep the chosen class valid when the student filter changes
  useEffect(() => {
    if (bookingId && !visibleClasses.some(c => c._id === bookingId)) setBookingId("");
  }, [visibleClasses, bookingId]);

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!isEdit && !bookingId) return setError("Please choose the class this recording belongs to.");
    if (!/^https?:\/\/\S+$/i.test(url.trim())) return setError("Please paste a valid link starting with https://");

    setSaving(true);
    try {
      const body = { url: url.trim(), note, durationMinutes: minutes };
      const { data } = isEdit
        ? await api.patch(`/recordings/${editing._id}/external`, body)
        : await api.post("/recordings/external", { ...body, bookingId });
      onSaved(data.recording);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save the link. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const label = { display: "block", fontSize: "12px", fontWeight: 800, color: col.text, marginBottom: "6px" };
  const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: `1px solid ${col.border}`, background: col.input, color: col.text, fontSize: "14px", fontFamily: "inherit", outline: "none" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9990, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <form onClick={e => e.stopPropagation()} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="ext-rec-title"
        style={{ background: col.card, borderRadius: "18px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", padding: "22px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", gap: "16px" }}>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Link2 size={20} color={col.accent} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 id="ext-rec-title" style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: col.text }}>
              {isEdit ? "Edit recording link" : "Add a recording link"}
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: col.muted, lineHeight: 1.5 }}>
              Recorded the class in Zoom or Google Meet instead of here? Paste the link so your school can see it.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        {!isEdit && (
          loading ? (
            <p style={{ margin: 0, fontSize: "13px", color: col.muted, display: "flex", alignItems: "center", gap: "8px" }}>
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading your classes…
            </p>
          ) : classes.length === 0 ? (
            <p style={{ margin: 0, fontSize: "13px", color: col.muted }}>
              No classes found in the last 90 days.
            </p>
          ) : (
            <>
              {!studentId && students.length > 1 && (
                <div>
                  <label style={label} htmlFor="ext-student">Student</label>
                  <select id="ext-student" value={student} onChange={e => setStudent(e.target.value)} style={field}>
                    <option value="">All students</option>
                    {students.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={label} htmlFor="ext-class">Class</label>
                <select id="ext-class" value={bookingId} onChange={e => setBookingId(e.target.value)} style={field} required>
                  <option value="">Choose the class…</option>
                  {visibleClasses.map(c => <option key={c._id} value={c._id}>{fmtClass(c)}</option>)}
                </select>
                {student && visibleClasses.length === 0 && (
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: col.muted }}>No classes with this student in the last 90 days.</p>
                )}
              </div>
            </>
          )
        )}

        <div>
          <label style={label} htmlFor="ext-url">Recording link</label>
          <input id="ext-url" type="url" inputMode="url" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://zoom.us/rec/share/…  or  https://drive.google.com/…" style={field} required />
          <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: col.muted, lineHeight: 1.5 }}>
            <strong>Zoom:</strong> Recordings → Share → Copy link. <strong>Google Meet:</strong> the recording is in your Google Drive → Share → Copy link.
            Make sure the link can be opened by your school admin.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "10px" }}>
          <div>
            <label style={label} htmlFor="ext-note">Note <span style={{ fontWeight: 600, color: col.muted }}>(optional)</span></label>
            <input id="ext-note" value={note} onChange={e => setNote(e.target.value)} maxLength={500}
              placeholder="e.g. Recorded in Zoom — passcode 1234" style={field} />
          </div>
          <div>
            <label style={label} htmlFor="ext-min">Minutes <span style={{ fontWeight: 600, color: col.muted }}>(opt.)</span></label>
            <input id="ext-min" type="number" min="0" max="600" value={minutes} onChange={e => setMinutes(e.target.value)}
              placeholder="45" style={field} />
          </div>
        </div>

        {error && (
          <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: "13px", fontWeight: 700 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: col.text, cursor: "pointer", fontSize: "13px", fontWeight: 800, fontFamily: "inherit" }}>
            Cancel
          </button>
          <button type="submit" disabled={saving || (!isEdit && (loading || classes.length === 0))}
            style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 800, fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px", opacity: saving ? 0.7 : 1 }}>
            {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : isEdit ? "Save changes" : "Save link"}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </form>
    </div>
  );
}
