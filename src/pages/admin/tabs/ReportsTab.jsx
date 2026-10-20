// src/pages/admin/tabs/ReportsTab.jsx
// Admin can preview or manually email a progress report for any student.

import { useState } from "react";
import { FileText, Send, Eye, ChevronDown } from "lucide-react";
import api from "../../../api";
import { visibleEmail } from "../../../utils/managedStudent.js";
import { useTranslation } from "react-i18next";

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

export default function ReportsTab({ students = [] }) {
  const { t: tr } = useTranslation("admin");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [period,   setPeriod]   = useState("monthly");
  const [refDate,  setRefDate]  = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [busy,   setBusy]   = useState(false);
  const [toast,  setToast]  = useState(null);

  const bg      = 'var(--a-raised)';
  const card    = 'var(--a-surface)';
  const border  = 'var(--a-line)';
  const text    = 'var(--a-ink)';
  const muted   = 'var(--a-ink-2)';
  const inputBg = 'var(--a-raised)';

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handlePreview() {
    if (!selectedStudent) return showToast(tr("reportsTab.pleaseSelectAStudent"), false);
    const q    = buildQuery(period, refDate);
    try {
      const resp = await api.get(`/reports/preview/${selectedStudent}${q}`, { responseType: 'blob' });
      const objUrl = URL.createObjectURL(new Blob([resp.data]));
      window.open(objUrl, "_blank");
    } catch (e) {
      showToast(e.response?.data?.error || tr("reportsTab.failedToGenerateReport"), false);
    }
  }

  async function handleSend() {
    if (!selectedStudent) return showToast(tr("reportsTab.pleaseSelectAStudent"), false);
    setBusy(true);
    try {
      const q    = buildQuery(period, refDate);
      const resp = await api.post(`/reports/send/${selectedStudent}${q}`);
      const data = resp.data;
      showToast(data.message || tr("reportsTab.reportSent"));
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
        <div className="ui-toast-in" role="status" style={{
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
          <FileText size={20} color="#16a34a" /> {tr("reportsTab.progressReports")}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
          {tr("reportsTab.generateAndEmailPdfProgress")}
        </p>
      </div>

      {/* Controls card */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 24, maxWidth: 560 }}>

        {/* Student picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{tr("reportsTab.student")}</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} style={inputStyle}>
            <option value="">{tr("reportsTab.selectAStudent")}</option>
            {students.map(s => (
              <option key={s._id} value={s._id}>
                {s.firstName} {s.lastName} · {visibleEmail(s.email) || "managed"}
              </option>
            ))}
          </select>
        </div>

        {/* Period */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{tr("reportsTab.reportPeriod")}</label>
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
            {period === "weekly" ? tr("reportsTab.anyDateWithinTheTarget") : tr("reportsTab.anyDateWithinTheTarget2")}
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
            <Eye size={15} /> {tr("reportsTab.previewPdf")}
          </button>

          <button onClick={handleSend} disabled={busy} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
            border: "none", background: "#16a34a", color: "#fff",
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
            fontFamily: "inherit",
          }}>
            <Send size={15} /> {busy ? tr("reportsTab.sending") : tr("reportsTab.emailToStudent")}
          </button>
        </div>
      </div>

      {/* Info panel */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20, maxWidth: 560, marginTop: 16 }}>
        <p style={{ margin: 0, fontSize: 12, color: muted, lineHeight: 1.7 }}>
          <strong style={{ color: text }}>{tr("reportsTab.whatSInTheReport")}</strong><br />
          {tr("reportsTab.completedClassesTotalStudyTime")}<br />
          {tr("reportsTab.gradedHomeworkWithScores")}<br />
          {tr("reportsTab.quizResultsAndAverages")}<br />
          {tr("reportsTab.vocabularyFlashcardReviewsMasteredWords")}<br />
          {tr("reportsTab.overallPerformanceBadgeExcellentGood")}
        </p>
      </div>
    </div>
  );
}
