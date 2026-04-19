// src/pages/admin/modals/StudentModal.jsx
import React, { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";

// Country list + dial codes — Vietnam first as primary market
const COUNTRIES = [
  { name: "Vietnam",          code: "VN", dial: "+84"  },
  { name: "Japan",            code: "JP", dial: "+81"  },
  { name: "South Korea",      code: "KR", dial: "+82"  },
  { name: "China",            code: "CN", dial: "+86"  },
  { name: "Thailand",         code: "TH", dial: "+66"  },
  { name: "Indonesia",        code: "ID", dial: "+62"  },
  { name: "Philippines",      code: "PH", dial: "+63"  },
  { name: "Malaysia",         code: "MY", dial: "+60"  },
  { name: "Cambodia",         code: "KH", dial: "+855" },
  { name: "Myanmar",          code: "MM", dial: "+95"  },
  { name: "Singapore",        code: "SG", dial: "+65"  },
  { name: "Taiwan",           code: "TW", dial: "+886" },
  { name: "Hong Kong",        code: "HK", dial: "+852" },
  { name: "India",            code: "IN", dial: "+91"  },
  { name: "Bangladesh",       code: "BD", dial: "+880" },
  { name: "Pakistan",         code: "PK", dial: "+92"  },
  { name: "Sri Lanka",        code: "LK", dial: "+94"  },
  { name: "Turkey",           code: "TR", dial: "+90"  },
  { name: "Saudi Arabia",     code: "SA", dial: "+966" },
  { name: "UAE",              code: "AE", dial: "+971" },
  { name: "Egypt",            code: "EG", dial: "+20"  },
  { name: "Morocco",          code: "MA", dial: "+212" },
  { name: "Brazil",           code: "BR", dial: "+55"  },
  { name: "Mexico",           code: "MX", dial: "+52"  },
  { name: "Colombia",         code: "CO", dial: "+57"  },
  { name: "Argentina",        code: "AR", dial: "+54"  },
  { name: "Spain",            code: "ES", dial: "+34"  },
  { name: "France",           code: "FR", dial: "+33"  },
  { name: "Germany",          code: "DE", dial: "+49"  },
  { name: "Italy",            code: "IT", dial: "+39"  },
  { name: "Portugal",         code: "PT", dial: "+351" },
  { name: "Poland",           code: "PL", dial: "+48"  },
  { name: "Russia",           code: "RU", dial: "+7"   },
  { name: "Ukraine",          code: "UA", dial: "+380" },
  { name: "United States",    code: "US", dial: "+1"   },
  { name: "United Kingdom",   code: "GB", dial: "+44"  },
  { name: "Canada",           code: "CA", dial: "+1"   },
  { name: "Australia",        code: "AU", dial: "+61"  },
  { name: "Other",            code: "",   dial: ""     },
];

const CEFR_LEVELS = [
  { value: "A1", label: "A1 — Beginner" },
  { value: "A2", label: "A2 — Elementary" },
  { value: "B1", label: "B1 — Pre-Intermediate" },
  { value: "B2", label: "B2 — Upper Intermediate" },
  { value: "C1", label: "C1 — Advanced" },
  { value: "C2", label: "C2 — Proficiency" },
];

const EMPTY = {
  firstName: "", lastName: "", age: "", email: "",
  dateOfBirth: "", rank: "",
  country: "", dialCode: "", phone: "",
};

export default function StudentModal({ isOpen, onClose, onSave, initialData, isDarkMode = false }) {
  const [formData, setFormData] = useState(EMPTY);
  const [invited,  setInvited]  = useState(false);
  const [savedStudent, setSavedStudent] = useState(null);
  const [loading,  setLoading]  = useState(false);

  const isEdit = !!initialData;

  useEffect(() => {
    if (initialData) {
      const country = COUNTRIES.find(c => c.name === initialData.country) || null;
      setFormData({
        firstName:   initialData.firstName   || "",
        lastName:     initialData.lastName     || "",
        age:         initialData.age         || "",
        email:       initialData.email       || "",
        dateOfBirth: initialData.dateOfBirth ? String(initialData.dateOfBirth).slice(0, 10) : "",
        rank:        initialData.rank        || "",
        country:     initialData.country     || "",
        dialCode:    country?.dial           || "",
        phone:       initialData.phone       || "",
      });
    } else {
      setFormData(EMPTY);
    }
    setInvited(false);
    setSavedStudent(null);
  }, [initialData, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCountryChange = (e) => {
    const selected = COUNTRIES.find(c => c.name === e.target.value);
    setFormData(prev => ({
      ...prev,
      country:  e.target.value,
      dialCode: selected?.dial || "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        phone: formData.dialCode && formData.phone
          ? `${formData.dialCode} ${formData.phone}`.trim()
          : formData.phone,
      };
      const result = await onSave(payload);
      if (!isEdit) {
        setSavedStudent(result?.student || formData);
        setInvited(true);
      } else {
        onClose();
      }
    } catch (err) {
      console.error("StudentModal save error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const dm = isDarkMode;
  const modalBg  = dm ? "#1e293b" : "#fff";
  const textPri  = dm ? "#f1f5f9" : "#1e293b";
  const textSec  = dm ? "#94a3b8" : "#64748b";
  const textMut  = dm ? "#64748b" : "#94a3b8";
  const borderC  = dm ? "#334155" : "#e2e8f0";
  const inputBg  = dm ? "#0f172a" : "#fff";
  const inputCol = dm ? "#f1f5f9" : "#1e293b";
  const labelCol = dm ? "#94a3b8" : "#374151";
  const infoBg   = dm ? "rgba(59,130,246,0.1)" : "#f0f7ff";
  const infoBdr  = dm ? "#1e40af" : "#bfdbfe";
  const badgeBg1 = dm ? "rgba(59,130,246,0.15)" : "#f0f7ff";
  const badgeBg2 = dm ? "rgba(5,150,105,0.15)"  : "#f0fdf4";
  const badgeBg3 = dm ? "rgba(124,58,237,0.15)" : "#faf5ff";
  const dialBg   = dm ? "#1e293b" : "#f8fafc";

  const lbl = { display: "block", fontSize: "12px", fontWeight: "700", color: labelCol, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" };
  const inp = { width: "100%", padding: "10px 13px", borderRadius: "10px", border: `1.5px solid ${borderC}`, background: inputBg, color: inputCol, fontFamily: "var(--font-body)", fontSize: "13.5px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
      <div style={{ background: modalBg, borderRadius: "20px", width: "100%", maxWidth: "520px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.3)", fontFamily: "var(--font-body)", overflow: "hidden", border: dm ? "1px solid #334155" : "none" }}>

        {/* ── INVITE SENT SUCCESS ── */}
        {invited ? (
          <div style={{ padding: "48px 40px", textAlign: "center", background: modalBg }}>
            <div style={{ fontSize: "60px", marginBottom: "12px" }}>📨</div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: textPri, marginBottom: "8px" }}>Invite Sent!</h2>
            <p style={{ fontSize: "14px", color: textSec, lineHeight: "1.7", marginBottom: "6px" }}>
              An invite email has been sent to
            </p>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#3b82f6", marginBottom: "20px" }}>
              {savedStudent?.email || formData.email}
            </p>
            <p style={{ fontSize: "13px", color: textMut, lineHeight: "1.6", marginBottom: "28px" }}>
              <strong>{savedStudent?.firstName || formData.firstName}</strong> will receive a link to set their password and activate their account. The link expires in <strong>48 hours</strong>.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginBottom: "28px" }}>
              {formData.rank && (
                <div style={{ background: badgeBg1, border: `1px solid ${infoBdr}`, borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: "700", color: "#3b82f6" }}>
                  🎓 {formData.rank}
                </div>
              )}
              {formData.country && (
                <div style={{ background: badgeBg2, border: "1px solid #a7f3d0", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: "700", color: "#059669" }}>
                  🌏 {formData.country}
                </div>
              )}
              <div style={{ background: badgeBg3, border: "1px solid #e9d5ff", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: "700", color: "#7c3aed" }}>
                🕐 Pending activation
              </div>
            </div>
            <button onClick={onClose} style={{ padding: "12px 32px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>
              Done
            </button>
          </div>
        ) : (
          <>
            {/* ── HEADER ── */}
            <div style={{ padding: "22px 26px 0", flexShrink: 0, borderBottom: `1px solid ${borderC}`, paddingBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: "800", color: textPri, margin: 0 }}>
                    {isEdit ? "Edit Student" : "Create Student"}
                  </h2>
                  {!isEdit && (
                    <p style={{ fontSize: "12px", color: textSec, margin: "3px 0 0" }}>
                      An invite email will be sent to the student
                    </p>
                  )}
                </div>
                <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: textMut, padding: "4px", display: "flex", alignItems: "center" }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ── FORM (scrollable) ── */}
            <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1, padding: "18px 26px 26px", background: modalBg }}>

              {/* Name row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={lbl}>First Name *</label>
                  <input style={inp} name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="e.g. Linh" />
                </div>
                <div>
                  <label style={lbl}>Surname *</label>
                  <input style={inp} name="lastName" value={formData.lastName} onChange={handleChange} required placeholder="e.g. Nguyen" />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: "12px" }}>
                <label style={lbl}>Email Address *</label>
                <input style={{ ...inp, opacity: isEdit ? 0.6 : 1 }} type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="student@email.com" disabled={isEdit} />
                {isEdit && <p style={{ fontSize: "11px", color: textMut, marginTop: "4px" }}>Email cannot be changed after creation</p>}
              </div>

              {/* Country + Phone */}
              <div style={{ marginBottom: "12px" }}>
                <label style={lbl}>Country</label>
                <div style={{ position: "relative" }}>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleCountryChange}
                    style={{ ...inp, appearance: "none", paddingRight: "32px", cursor: "pointer" }}
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => (
                      <option key={c.code + c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: textMut, pointerEvents: "none" }} />
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={lbl}>Phone Number</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {/* Dial code badge */}
                  <div style={{ display: "flex", alignItems: "center", padding: "0 12px", borderRadius: "10px", border: `1.5px solid ${borderC}`, background: dialBg, fontSize: "13px", fontWeight: "600", color: dm ? "#94a3b8" : "#475569", whiteSpace: "nowrap", minWidth: "70px", justifyContent: "center" }}>
                    {formData.dialCode || "—"}
                  </div>
                  <input
                    style={{ ...inp, flex: 1 }}
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder={formData.country === "Vietnam" ? "90 123 4567" : "Phone number"}
                  />
                </div>
                {formData.dialCode && formData.phone && (
                  <p style={{ fontSize: "11px", color: textSec, marginTop: "4px" }}>
                    Will be saved as: <strong>{formData.dialCode} {formData.phone}</strong>
                  </p>
                )}
              </div>

              {/* Age + DOB */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={lbl}>Age</label>
                  <input style={inp} type="number" name="age" value={formData.age} onChange={handleChange} placeholder="e.g. 14" min="3" max="99" />
                </div>
                <div>
                  <label style={lbl}>Date of Birth</label>
                  <input style={inp} type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} />
                </div>
              </div>

              {/* CEFR Level */}
              <div style={{ marginBottom: "18px" }}>
                <label style={lbl}>ESL Level (CEFR)</label>
                <div style={{ position: "relative" }}>
                  <select
                    name="rank"
                    value={formData.rank}
                    onChange={handleChange}
                    style={{ ...inp, appearance: "none", paddingRight: "32px", cursor: "pointer" }}
                  >
                    <option value="">Select level</option>
                    {CEFR_LEVELS.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: textMut, pointerEvents: "none" }} />
                </div>
              </div>

              {/* Invite notice */}
              {!isEdit && (
                <div style={{ background: infoBg, border: `1px solid ${infoBdr}`, borderRadius: "12px", padding: "12px 14px", marginBottom: "18px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>📧</span>
                  <div>
                    <p style={{ fontSize: "12.5px", fontWeight: "700", color: "#1e40af", margin: "0 0 2px" }}>Invite email will be sent</p>
                    <p style={{ fontSize: "11.5px", color: "#3b82f6", margin: 0 }}>Student receives a link to set their password and activate their account.</p>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: `1.5px solid ${borderC}`, background: "transparent", color: dm ? "#94a3b8" : "#475569", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: loading ? "#94a3b8" : "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {loading ? "Saving…" : isEdit ? "Save Changes" : "Create & Send Invite"}
                </button>
              </div>

            </form>
          </>
        )}
      </div>
    </div>
  );
}

