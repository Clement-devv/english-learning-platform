// src/pages/admin/modals/StudentModal.jsx - UPDATED WITH INVITE FLOW
import React, { useState, useEffect } from "react";

export default function StudentModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    firstName:   "",
    surname:     "",
    age:         "",
    email:       "",
    noOfClasses: "",
    dateOfBirth: "",
    rank:        "",
  });
  const [invited, setInvited]   = useState(false); // show success state
  const [savedStudent, setSavedStudent] = useState(null);
  const [loading, setLoading]   = useState(false);

  const isEdit = !!initialData;

  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName:   initialData.firstName   || "",
        surname:     initialData.surname     || "",
        age:         initialData.age         || "",
        email:       initialData.email       || "",
        noOfClasses: initialData.noOfClasses || "",
        dateOfBirth: initialData.dateOfBirth ? initialData.dateOfBirth.slice(0, 10) : "",
        rank:        initialData.rank        || "",
      });
    } else {
      setFormData({ firstName:"", surname:"", age:"", email:"", noOfClasses:"", dateOfBirth:"", rank:"" });
    }
    setInvited(false);
    setSavedStudent(null);
  }, [initialData, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await onSave(formData);
      if (!isEdit) {
        // New student → show invite-sent screen
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

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:"20px" }}>
      <div style={{ background:"#fff", borderRadius:"20px", width:"100%", maxWidth:"480px", boxShadow:"0 24px 80px rgba(0,0,0,0.2)", overflow:"hidden", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>

        {/* ── INVITE SENT SUCCESS ── */}
        {invited ? (
          <div style={{ padding:"48px 40px", textAlign:"center" }}>
            <div style={{ fontSize:"60px", marginBottom:"12px" }}>📨</div>
            <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#1e293b", marginBottom:"8px" }}>Invite Sent!</h2>
            <p style={{ fontSize:"14px", color:"#64748b", lineHeight:"1.7", marginBottom:"6px" }}>
              An invite email has been sent to
            </p>
            <p style={{ fontSize:"15px", fontWeight:"700", color:"#3b82f6", marginBottom:"20px" }}>
              {savedStudent?.email || formData.email}
            </p>
            <p style={{ fontSize:"13px", color:"#94a3b8", lineHeight:"1.6", marginBottom:"28px" }}>
              <strong>{savedStudent?.firstName || formData.firstName}</strong> will receive a link to set their password and activate their account. The link expires in <strong>48 hours</strong>.
            </p>

            {/* Info pills */}
            <div style={{ display:"flex", gap:"10px", justifyContent:"center", flexWrap:"wrap", marginBottom:"28px" }}>
              <div style={{ background:"#f0f7ff", border:"1px solid #bfdbfe", borderRadius:"20px", padding:"5px 14px", fontSize:"12px", fontWeight:"700", color:"#3b82f6" }}>
                📚 {savedStudent?.noOfClasses || formData.noOfClasses || 0} classes
              </div>
              <div style={{ background:"#f0fdf4", border:"1px solid #a7f3d0", borderRadius:"20px", padding:"5px 14px", fontSize:"12px", fontWeight:"700", color:"#059669" }}>
                🕐 Pending activation
              </div>
            </div>

            <button onClick={onClose}
              style={{ padding:"12px 32px", borderRadius:"12px", border:"none", background:"linear-gradient(135deg,#3b82f6,#6366f1)", color:"#fff", fontSize:"14px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" }}>
              Done
            </button>
          </div>
        ) : (
          <>
            {/* ── HEADER ── */}
            <div style={{ padding:"24px 28px 0" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px" }}>
                <div>
                  <h2 style={{ fontSize:"18px", fontWeight:"800", color:"#1e293b", margin:0 }}>
                    {isEdit ? "Edit Student" : "Create Student"}
                  </h2>
                  {!isEdit && (
                    <p style={{ fontSize:"12.5px", color:"#64748b", margin:"4px 0 0" }}>
                      An invite email will be sent to the student
                    </p>
                  )}
                </div>
                <button onClick={onClose}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:"20px", color:"#94a3b8", lineHeight:1, padding:"4px" }}>✕</button>
              </div>
            </div>

            {/* ── FORM ── */}
            <form onSubmit={handleSubmit} style={{ padding:"0 28px 28px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"12px" }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input style={inputStyle} type="text" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="e.g. John" />
                </div>
                <div>
                  <label style={labelStyle}>Surname *</label>
                  <input style={inputStyle} type="text" name="surname" value={formData.surname} onChange={handleChange} required placeholder="e.g. Smith" />
                </div>
              </div>

              <div style={{ marginBottom:"12px" }}>
                <label style={labelStyle}>Email Address *</label>
                <input style={inputStyle} type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="student@email.com" disabled={isEdit} />
                {isEdit && <p style={{ fontSize:"11px", color:"#94a3b8", marginTop:"4px" }}>Email cannot be changed after creation</p>}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"12px" }}>
                <div>
                  <label style={labelStyle}>Age</label>
                  <input style={inputStyle} type="number" name="age" value={formData.age} onChange={handleChange} placeholder="e.g. 12" min="3" max="99" />
                </div>
                <div>
                  <label style={labelStyle}>No. of Classes</label>
                  <input style={inputStyle} type="number" name="noOfClasses" value={formData.noOfClasses} onChange={handleChange} placeholder="e.g. 10" min="0" />
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"20px" }}>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input style={inputStyle} type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} />
                </div>
                <div>
                  <label style={labelStyle}>Rank / Level</label>
                  <input style={inputStyle} type="text" name="rank" value={formData.rank} onChange={handleChange} placeholder="e.g. A2, Beginner" />
                </div>
              </div>

              {/* Invite notice banner for new students */}
              {!isEdit && (
                <div style={{ background:"#f0f7ff", border:"1px solid #bfdbfe", borderRadius:"12px", padding:"12px 16px", marginBottom:"20px", display:"flex", gap:"10px", alignItems:"flex-start" }}>
                  <span style={{ fontSize:"18px", flexShrink:0 }}>📧</span>
                  <div>
                    <p style={{ fontSize:"13px", fontWeight:"700", color:"#1e40af", margin:"0 0 2px" }}>Invite email will be sent</p>
                    <p style={{ fontSize:"12px", color:"#3b82f6", margin:0 }}>The student will receive a link to set their own password and activate their account.</p>
                  </div>
                </div>
              )}

              <div style={{ display:"flex", gap:"10px" }}>
                <button type="button" onClick={onClose}
                  style={{ flex:1, padding:"11px", borderRadius:"10px", border:"1.5px solid #e2e8f0", background:"transparent", color:"#475569", fontSize:"14px", fontWeight:"600", cursor:"pointer", fontFamily:"inherit" }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex:2, padding:"11px", borderRadius:"10px", border:"none", background: loading ? "#94a3b8" : "linear-gradient(135deg,#3b82f6,#6366f1)", color:"#fff", fontSize:"14px", fontWeight:"700", cursor: loading ? "not-allowed" : "pointer", fontFamily:"inherit" }}>
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

const labelStyle = { display:"block", fontSize:"12.5px", fontWeight:"700", color:"#374151", marginBottom:"5px" };
const inputStyle  = { width:"100%", padding:"10px 13px", borderRadius:"10px", border:"1.5px solid #e2e8f0", fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize:"14px", color:"#1e293b", outline:"none", boxSizing:"border-box" };
