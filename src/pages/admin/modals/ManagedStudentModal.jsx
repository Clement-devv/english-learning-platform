// src/pages/admin/modals/ManagedStudentModal.jsx
// Create / edit a managed student — a name-only, no-login student record the
// admin manages on the student's behalf (for centers that don't onboard students).
import React, { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";

const CEFR_LEVELS = [
  { value: "A1", label: "A1 — Beginner" },
  { value: "A2", label: "A2 — Elementary" },
  { value: "B1", label: "B1 — Pre-Intermediate" },
  { value: "B2", label: "B2 — Upper Intermediate" },
  { value: "C1", label: "C1 — Advanced" },
  { value: "C2", label: "C2 — Proficiency" },
];

const EMPTY = { firstName: "", lastName: "", age: "", rank: "" };

export default function ManagedStudentModal({ isOpen, onClose, onSave, initialData, isDarkMode = false }) {
  const [formData, setFormData] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  useEffect(() => {
    setFormData(initialData
      ? {
          firstName: initialData.firstName || "",
          lastName:  initialData.lastName  || "",
          age:       initialData.age       || "",
          rank:      initialData.rank      || "",
        }
      : EMPTY);
  }, [initialData, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ok = await onSave({ ...formData, firstName: formData.firstName.trim(), lastName: formData.lastName.trim() });
      if (ok !== false) onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const dm = isDarkMode;
  const modalBg = dm ? "#1e293b" : "#fff";
  const textPri = dm ? "#f1f5f9" : "#1e293b";
  const textSec = dm ? "#94a3b8" : "#64748b";
  const textMut = dm ? "#64748b" : "#94a3b8";
  const borderC = dm ? "#334155" : "#e2e8f0";

  const lbl = { display: "block", fontSize: "12px", fontWeight: "700", color: dm ? "#94a3b8" : "#374151", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" };
  const inp = { width: "100%", padding: "10px 13px", borderRadius: "10px", border: `1.5px solid ${borderC}`, background: dm ? "#0f172a" : "#fff", color: dm ? "#f1f5f9" : "#1e293b", fontFamily: "var(--font-body)", fontSize: "13.5px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
      <div style={{ background: modalBg, borderRadius: "20px", width: "100%", maxWidth: "460px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.3)", fontFamily: "var(--font-body)", overflow: "hidden", border: dm ? "1px solid #334155" : "none" }}>

        {/* ── HEADER ── */}
        <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${borderC}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "800", color: textPri, margin: 0 }}>
              {isEdit ? "Edit Managed Student" : "Create Managed Student"}
            </h2>
            <p style={{ fontSize: "12px", color: textSec, margin: "3px 0 0" }}>
              Name only — no email, no login
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: textMut, padding: "4px", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* ── FORM ── */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1, padding: "18px 26px 26px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={lbl}>Name *</label>
              <input style={inp} name="firstName" value={formData.firstName} onChange={handleChange} required autoFocus placeholder="e.g. Linh" />
            </div>
            <div>
              <label style={lbl}>Surname</label>
              <input style={inp} name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Optional" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "18px" }}>
            <div>
              <label style={lbl}>Age</label>
              <input style={inp} type="number" name="age" value={formData.age} onChange={handleChange} placeholder="Optional" min="3" max="99" />
            </div>
            <div>
              <label style={lbl}>ESL Level</label>
              <div style={{ position: "relative" }}>
                <select name="rank" value={formData.rank} onChange={handleChange} style={{ ...inp, appearance: "none", paddingRight: "32px", cursor: "pointer" }}>
                  <option value="">Select level</option>
                  {CEFR_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: textMut, pointerEvents: "none" }} />
              </div>
            </div>
          </div>

          {!isEdit && (
            <div style={{ background: dm ? "rgba(245,158,11,0.1)" : "#fffbeb", border: `1px solid ${dm ? "#92400e" : "#fde68a"}`, borderRadius: "12px", padding: "12px 14px", marginBottom: "18px" }}>
              <p style={{ fontSize: "12.5px", fontWeight: "700", color: dm ? "#fcd34d" : "#92400e", margin: "0 0 2px" }}>Active immediately</p>
              <p style={{ fontSize: "11.5px", color: dm ? "#fbbf24" : "#b45309", margin: 0 }}>
                Assign to teachers, book classes and add credits like any student. This student cannot log in.
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: `1.5px solid ${borderC}`, background: "transparent", color: dm ? "#94a3b8" : "#475569", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: loading ? "#94a3b8" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Managed Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
