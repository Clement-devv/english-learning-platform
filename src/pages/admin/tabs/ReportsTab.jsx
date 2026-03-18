// src/pages/admin/tabs/ReportsTab.jsx
// Admin can preview or manually email a progress report for any student.

import { useState } from "react";
import { FileText, Send, Eye, ChevronDown } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function authHeader() {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Build query string for period + reference date
function buildQuery(period, refDate) {
  if (period === "weekly") {
    // Convert to ISO week string e.g. 2026-W10
    const d    = new Date(refDate);
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const week = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
    return `?period=weekly&week=${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  // monthly
  const d = new Date(refDate);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `?period=monthly&month=${yr}-${mo}`;
}

export default function ReportsTab({ students = [], isDarkMode }) {
  const [selectedStudent, setSelectedStudent] = useState("");
  const [period,   setPeriod]   = useState("monthly");
  const [refDate,  setRefDate]  = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [busy,   setBusy]   = useState(false);
  const [toast,  setToast]  = useState(null);

  const bg      = isDarkMode ? "#0f172a" : "#f8fafc";
  const card    = isDarkMode ? "#1e293b" : "#ffffff";
  const border  = isDarkMode ? "#334155" : "#e2e8f0";
  const text    = isDarkMode ? "#e2e8f0" : "#1e293b";
  const muted   = isDarkMode ? "#94a3b8" : "#64748b";
  const inputBg = isDarkMode ? "#0f172a" : "#f8fafc";

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handlePreview() {
    if (!selectedStudent) return showToast("Please select a student", false);
    const q    = buildQuery(period, refDate);
    const url  = `${API}/api/reports/preview/${selectedStudent}${q}`;
    const resp = await fetch(url, { headers: authHeader() });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Unknown error" }));
      return showToast(err.error || "Failed to generate report", false);
    }
    const blob  = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    window.open(objUrl, "_blank");
  }

  async function handleSend() {
    if (!selectedStudent) return showToast("Please select a student", false);
    setBusy(true);
    try {
      const q    = buildQuery(period, refDate);
      const resp = await fetch(`${API}/api/reports/send/${selectedStudent}${q}`, {
        method:  "POST",
        headers: authHeader(),
      });
      const data = await resp.json();
      if (resp.ok) showToast(data.message || "Report sent!");
      else         showToast(data.error || "Failed to send report", false);
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
    border: `1px solid ${border}`, background: inputBg, color: text,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: muted, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" };

  return (
    <div style={{ padding: 24, background: bg, minHeight: "100vh" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          background: toast.ok ? "#16a34a" : "#dc2626",
          color: "#fff", padding: "10px 18px", borderRadius: 8,
          fontSize: 13, fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: text, display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={20} color="#16a34a" /> Progress Reports
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
          Generate and email PDF progress reports for students. Reports are also sent automatically (weekly every Monday, monthly on the 1st).
        </p>
      </div>

      {/* Controls card */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 24, maxWidth: 560 }}>

        {/* Student picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Student</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} style={inputStyle}>
            <option value="">— Select a student —</option>
            {students.map(s => (
              <option key={s._id} value={s._id}>
                {s.firstName} {s.surname} · {s.email}
              </option>
            ))}
          </select>
        </div>

        {/* Period */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Report period</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["monthly", "weekly"].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                border: `1px solid ${period === p ? "#16a34a" : border}`,
                background: period === p ? "#16a34a" : inputBg,
                color: period === p ? "#fff" : text,
                cursor: "pointer", fontFamily: "inherit",
                textTransform: "capitalize",
              }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Reference date */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>
            {period === "weekly" ? "Any date within the target week" : "Any date within the target month"}
          </label>
          <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} style={inputStyle} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handlePreview} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
            border: `1px solid #16a34a`, background: "transparent", color: "#16a34a",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            <Eye size={15} /> Preview PDF
          </button>

          <button onClick={handleSend} disabled={busy} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
            border: "none", background: "#16a34a", color: "#fff",
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
            fontFamily: "inherit",
          }}>
            <Send size={15} /> {busy ? "Sending…" : "Email to Student"}
          </button>
        </div>
      </div>

      {/* Info panel */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20, maxWidth: 560, marginTop: 16 }}>
        <p style={{ margin: 0, fontSize: 12, color: muted, lineHeight: 1.7 }}>
          <strong style={{ color: text }}>What's in the report?</strong><br />
          ✅ Completed classes &amp; total study time<br />
          📝 Graded homework with scores<br />
          🧠 Quiz results and averages<br />
          📖 Vocabulary flashcard reviews &amp; mastered words<br />
          🏅 Overall performance badge (Excellent / Good / Passed / Keep Practising)
        </p>
      </div>
    </div>
  );
}
