import React, { useState, useEffect, useRef } from "react";
import {
  User, Mail, Phone, Globe, DollarSign, Video,
  BookOpen, Award, Save, Edit2, X, CheckCircle, ChevronDown,
  Camera, Trash2, Loader, Lock, Star, MessageSquare,
} from "lucide-react";
import api from "../../../api";
import { TIMEZONE_OPTIONS } from "../../../utils/timezone";

const SPECIALIZATIONS = [
  "General English", "Business English", "Conversation",
  "IELTS Prep", "TOEFL Prep", "Grammar", "Pronunciation",
  "Kids & Young Learners", "Academic Writing", "Interview Coaching",
];

const CERTIFICATIONS = ["CELTA", "TEFL", "TESOL", "PGCE", "Delta", "Trinity CertTESOL"];


function Section({ icon: Icon, title, children, c }) {
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(var(--brand-primary-rgb),0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color="var(--brand-primary)" />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.muted }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, c }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: c.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      <span style={{ fontSize: 14, color: value ? c.heading : c.muted, fontStyle: value ? "normal" : "italic" }}>
        {value || "Not set"}
      </span>
    </div>
  );
}

function Chip({ label, color = "brand" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: color === "brand" ? "rgba(var(--brand-primary-rgb),0.1)" : "rgba(16,185,129,0.1)",
      color: color === "brand" ? "var(--brand-primary)" : "#10b981",
      border: color === "brand" ? "1px solid rgba(var(--brand-primary-rgb),0.2)" : "1px solid rgba(16,185,129,0.2)",
    }}>
      {label}
    </span>
  );
}

export default function ProfileTab({ teacherInfo, isDarkMode, onUpdate }) {
  const c = {
    bg:          isDarkMode ? "#0f1117" : "#f8f9ff",
    card:        isDarkMode ? "#1a1f2e" : "#ffffff",
    border:      isDarkMode ? "#1e2235" : "#e8ecf8",
    heading:     isDarkMode ? "#e2e8f0" : "#1a1d2e",
    muted:       isDarkMode ? "#64748b" : "#6b7280",
    input:       isDarkMode ? "#0f1117" : "#f8f9ff",
    inputBorder: isDarkMode ? "#2d3347" : "#e2e8f0",
    lockBg:      isDarkMode ? "#1a1f2e" : "#f1f5f9",
  };

  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");
  const [form,    setForm]    = useState({});

  // Reviews state
  const [reviews,      setReviews]      = useState([]);
  const [reviewStats,  setReviewStats]  = useState(null); // { total, avgRating, dist }
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Photo state
  const [photoPreview,    setPhotoPreview]    = useState("");
  const [photoUploading,  setPhotoUploading]  = useState(false);
  const [photoError,      setPhotoError]      = useState("");
  const photoInputRef = useRef(null);

  // Fetch reviews once teacherInfo is available
  useEffect(() => {
    if (!teacherInfo?._id && !teacherInfo?.id) return;
    const tid = teacherInfo._id || teacherInfo.id;
    setReviewsLoading(true);
    api.get(`/reviews/teacher/${tid}`)
      .then((res) => { setReviews(res.data.reviews || []); setReviewStats(res.data.stats || null); })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [teacherInfo?._id, teacherInfo?.id]); // eslint-disable-line

  useEffect(() => {
    if (teacherInfo) {
      setPhotoPreview(teacherInfo.photo || "");
      setForm({
        displayName:       teacherInfo.displayName     || "",
        phone:             teacherInfo.phone           || "",
        timezone:          teacherInfo.timezone        || "",
        googleMeetLink:    teacherInfo.googleMeetLink  || "",
        zoomLink:          teacherInfo.zoomLink        || "",
        bio:               teacherInfo.bio             || "",
        yearsOfExperience: teacherInfo.yearsOfExperience ?? "",
        specializations:   teacherInfo.specializations || [],
        certifications:    teacherInfo.certifications  || [],
      });
    }
  }, [teacherInfo]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleChip = (key, val) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((v) => v !== val) : [...f[key], val],
    }));
  };

  // ── Photo upload ──────────────────────────────────────────────────────────
  const teacherId = teacherInfo?._id || teacherInfo?.id;

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await api.post(`/teachers/${teacherId}/photo`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPhotoPreview(res.data.photo);
      onUpdate({ ...teacherInfo, photo: res.data.photo });
    } catch (err) {
      setPhotoError(err.response?.data?.message || "Upload failed — max 3 MB, JPG/PNG/WebP only");
      setPhotoPreview(teacherInfo?.photo || "");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    setPhotoError("");
    try {
      await api.delete(`/teachers/${teacherId}/photo`);
      setPhotoPreview("");
      onUpdate({ ...teacherInfo, photo: "" });
    } catch {
      setPhotoError("Could not remove photo");
    } finally {
      setPhotoUploading(false);
    }
  };

  // ── Save profile (self-editable fields only) ──────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await api.patch(`/teachers/${teacherId}/profile`, {
        displayName:       form.displayName.trim(),
        phone:             form.phone.trim(),
        timezone:          form.timezone,
        googleMeetLink:    form.googleMeetLink.trim(),
        zoomLink:          form.zoomLink.trim(),
        bio:               form.bio.trim(),
        yearsOfExperience: parseInt(form.yearsOfExperience) || 0,
        specializations:   form.specializations,
        certifications:    form.certifications,
      });
      onUpdate(data);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13.5,
    border: `1px solid ${c.inputBorder}`, background: c.input, color: c.heading,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };
  const lockedStyle = {
    ...inputStyle, opacity: 0.6, cursor: "not-allowed", background: c.lockBg,
  };
  const selectStyle = { ...inputStyle, appearance: "none", paddingRight: 32, cursor: "pointer" };

  if (!teacherInfo) return null;

  const displayedName = teacherInfo.displayName
    ? teacherInfo.displayName
    : `${teacherInfo.firstName || ""} ${teacherInfo.lastName || ""}`.trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: c.heading, fontFamily: "var(--font-display)" }}>
            My Profile
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: c.muted }}>
            Manage your profile photo, display name and teaching details
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {saved && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#10b981", fontSize: 13, fontWeight: 600 }}>
              <CheckCircle size={15} /> Saved!
            </div>
          )}
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setError(""); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.card, color: c.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <X size={14} /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: "var(--brand-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "inherit" }}>
                <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: `1px solid rgba(var(--brand-primary-rgb),0.3)`, background: "rgba(var(--brand-primary-rgb),0.08)", color: "var(--brand-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Edit2 size={14} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Profile Photo Card ── */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(var(--brand-primary-rgb),0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Camera size={16} color="var(--brand-primary)" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.muted }}>Profile Photo</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* Photo circle */}
          <div style={{ position: "relative", width: 88, height: 88, borderRadius: 24, overflow: "hidden", flexShrink: 0, background: c.lockBg, border: `2px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {photoPreview ? (
              <img src={photoPreview} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 32, fontWeight: 800, color: "var(--brand-primary)" }}>
                {(teacherInfo.firstName?.[0] || "T").toUpperCase()}
              </span>
            )}
            {photoUploading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 24 }}>
                <Loader size={20} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handlePhotoSelect} />
            <button
              type="button"
              disabled={photoUploading}
              onClick={() => photoInputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, border: "none", background: "var(--brand-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: photoUploading ? "not-allowed" : "pointer", opacity: photoUploading ? 0.6 : 1, fontFamily: "inherit" }}
            >
              <Camera size={14} />
              {photoPreview ? "Change Photo" : "Upload Photo"}
            </button>
            {photoPreview && (
              <button
                type="button"
                disabled={photoUploading}
                onClick={handleRemovePhoto}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, border: `1px solid rgba(239,68,68,0.3)`, background: "rgba(239,68,68,0.06)", color: "#ef4444", fontSize: 13, fontWeight: 600, cursor: photoUploading ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                <Trash2 size={14} />
                Remove Photo
              </button>
            )}
            <p style={{ fontSize: 11.5, color: c.muted, margin: 0 }}>JPG, PNG or WebP · max 3 MB · Square crop recommended</p>
            {photoError && <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, margin: 0 }}>{photoError}</p>}
          </div>
        </div>
      </div>

      {/* ── Hero banner ── */}
      <div style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))`, borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", border: "2px solid rgba(255,255,255,0.4)", flexShrink: 0, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {photoPreview ? (
            <img src={photoPreview} alt={displayedName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
              {(teacherInfo.firstName?.[0] || "T").toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>{displayedName}</p>
          {teacherInfo.displayName && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              {teacherInfo.firstName} {teacherInfo.lastName}
            </p>
          )}
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{teacherInfo.email}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {teacherInfo.continent && <Chip label={teacherInfo.continent} />}
            {teacherInfo.timezone && <Chip label={teacherInfo.timezone} />}
            {typeof teacherInfo.ratePerClass === "number" && (
              <Chip label={`$${teacherInfo.ratePerClass}/class`} color="green" />
            )}
          </div>
        </div>
      </div>

      {/* ── Personal Info ── */}
      <Section icon={User} title="Personal Information" c={c}>
        {editing ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Display name — teacher can set */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Display Name <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#10b981" }}>(nickname shown to students)</span>
              </label>
              <input value={form.displayName} onChange={set("displayName")} placeholder={`${teacherInfo.firstName} ${teacherInfo.lastName}`.trim()} style={inputStyle} maxLength={50} />
              <p style={{ margin: "4px 0 0", fontSize: 11.5, color: c.muted }}>Leave blank to use your real name</p>
            </div>

            {/* Phone — teacher can set */}
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Phone / WhatsApp</label>
              <input value={form.phone} onChange={set("phone")} placeholder="+1 234 567 8900" style={inputStyle} />
            </div>

            {/* Email — always locked */}
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Email <span style={{ fontWeight: 400, color: c.muted }}>(fixed)</span>
              </label>
              <input value={teacherInfo.email} disabled style={lockedStyle} />
            </div>

            {/* First & Last Name — admin only */}
            {[
              { label: "First Name", value: teacherInfo.firstName },
              { label: "Last Name",  value: teacherInfo.lastName  },
              { label: "Country",    value: teacherInfo.country   },
              { label: "Continent",  value: teacherInfo.continent },
            ].map(({ label, value }) => (
              <div key={label}>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  <Lock size={11} /> {label} <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(admin only)</span>
                </label>
                <input value={value || ""} disabled style={lockedStyle} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 18 }}>
            {teacherInfo.displayName && <InfoRow label="Display Name" value={teacherInfo.displayName} c={c} />}
            <InfoRow label="First Name"  value={teacherInfo.firstName}  c={c} />
            <InfoRow label="Last Name"   value={teacherInfo.lastName}   c={c} />
            <InfoRow label="Email"       value={teacherInfo.email}      c={c} />
            <InfoRow label="Phone"       value={teacherInfo.phone}      c={c} />
            <InfoRow label="Country"     value={teacherInfo.country}    c={c} />
            <InfoRow label="Continent"   value={teacherInfo.continent}  c={c} />
          </div>
        )}
      </Section>

      {/* ── Professional Details ── */}
      <Section icon={DollarSign} title="Professional Details" c={c}>
        {editing ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Years of Experience</label>
              <input value={form.yearsOfExperience} onChange={set("yearsOfExperience")} type="number" min="0" max="50" placeholder="e.g. 3" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                <Lock size={11} /> Rate per Class <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(admin only)</span>
              </label>
              <input value={`$${teacherInfo.ratePerClass ?? 0}`} disabled style={lockedStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Timezone</label>
              <div style={{ position: "relative" }}>
                <select value={form.timezone} onChange={set("timezone")} style={selectStyle}>
                  <option value="">Select timezone</option>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: c.muted }} />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Google Meet Link</label>
              <input value={form.googleMeetLink} onChange={set("googleMeetLink")} type="url" placeholder="https://meet.google.com/xxx-xxxx-xxx" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Zoom Link</label>
              <input value={form.zoomLink} onChange={set("zoomLink")} type="url" placeholder="https://zoom.us/j/123456789" style={inputStyle} />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 18 }}>
            <InfoRow label="Rate per Class"      value={`$${teacherInfo.ratePerClass ?? 0}`} c={c} />
            <InfoRow label="Years of Experience" value={teacherInfo.yearsOfExperience ? `${teacherInfo.yearsOfExperience} yrs` : null} c={c} />
            <InfoRow label="Timezone"
              value={TIMEZONE_OPTIONS.find(t => t.value === teacherInfo.timezone)?.label || teacherInfo.timezone}
              c={c} />
            <InfoRow label="Google Meet"  value={teacherInfo.googleMeetLink} c={c} />
            <InfoRow label="Zoom Link"    value={teacherInfo.zoomLink}       c={c} />
          </div>
        )}
      </Section>

      {/* ── Teaching Profile ── */}
      <Section icon={BookOpen} title="Teaching Profile" c={c}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>Specializations</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SPECIALIZATIONS.map((s) => (
                  <button key={s} type="button" onClick={() => toggleChip("specializations", s)} style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    background: form.specializations.includes(s) ? "var(--brand-primary)" : c.input,
                    color:      form.specializations.includes(s) ? "#fff" : c.muted,
                    border:     form.specializations.includes(s) ? "1px solid var(--brand-primary)" : `1px solid ${c.inputBorder}`,
                  }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>Certifications</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CERTIFICATIONS.map((cert) => (
                  <button key={cert} type="button" onClick={() => toggleChip("certifications", cert)} style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    background: form.certifications.includes(cert) ? "var(--brand-primary)" : c.input,
                    color:      form.certifications.includes(cert) ? "#fff" : c.muted,
                    border:     form.certifications.includes(cert) ? "1px solid var(--brand-primary)" : `1px solid ${c.inputBorder}`,
                  }}>
                    {cert}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: c.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Bio / About</label>
              <textarea value={form.bio} onChange={set("bio")} rows={4} maxLength={500} placeholder="Brief description shown to students..." style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
              <p style={{ margin: "4px 0 0", fontSize: 11.5, color: c.muted, textAlign: "right" }}>{form.bio.length}/500</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {teacherInfo.bio && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>About</p>
                <p style={{ margin: 0, fontSize: 14, color: c.heading, lineHeight: 1.65 }}>{teacherInfo.bio}</p>
              </div>
            )}
            {teacherInfo.specializations?.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Specializations</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {teacherInfo.specializations.map((s) => <Chip key={s} label={s} />)}
                </div>
              </div>
            )}
            {teacherInfo.certifications?.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Certifications</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {teacherInfo.certifications.map((cert) => <Chip key={cert} label={cert} color="green" />)}
                </div>
              </div>
            )}
            {!teacherInfo.bio && !teacherInfo.specializations?.length && !teacherInfo.certifications?.length && (
              <p style={{ fontSize: 13.5, color: c.muted, fontStyle: "italic" }}>No teaching profile set yet. Click "Edit Profile" to add your details.</p>
            )}
          </div>
        )}
      </Section>

      {/* ── Account Info (view only) ── */}
      {!editing && (
        <Section icon={Award} title="Account Info" c={c}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 18 }}>
            <InfoRow label="Status"             value={teacherInfo.status}    c={c} />
            <InfoRow label="Lessons Completed"  value={teacherInfo.lessonsCompleted?.toString()} c={c} />
            <InfoRow label="Total Earned"       value={teacherInfo.earned != null ? `$${teacherInfo.earned}` : null} c={c} />
            <InfoRow label="Last Login"         value={teacherInfo.lastLogin ? new Date(teacherInfo.lastLogin).toLocaleDateString() : null} c={c} />
          </div>
        </Section>
      )}

      {/* ── My Reviews ── */}
      {!editing && (
        <Section icon={Star} title="My Reviews" c={c}>
          {reviewsLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.muted, fontSize: 13 }}>
              <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading reviews…
            </div>
          ) : !reviewStats || reviewStats.total === 0 ? (
            <p style={{ fontSize: 13, color: c.muted, fontStyle: "italic" }}>No reviews yet. Reviews appear here after students rate completed classes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Summary row */}
              <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                {/* Big score */}
                <div style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 48, fontWeight: 900, color: "#f59e0b", lineHeight: 1 }}>
                    {reviewStats.avgRating?.toFixed(1)}
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 2, margin: "4px 0" }}>
                    {[1,2,3,4,5].map((n) => {
                      const pct = Math.min(100, Math.max(0, (reviewStats.avgRating - (n - 1)) * 100));
                      return (
                        <div key={n} style={{ position: "relative", fontSize: 18, lineHeight: 1 }}>
                          <span style={{ color: isDarkMode ? "#374151" : "#d1d5db" }}>★</span>
                          <span style={{ position: "absolute", inset: 0, overflow: "hidden", width: `${pct}%`, color: "#f59e0b" }}>★</span>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: c.muted }}>{reviewStats.total} review{reviewStats.total !== 1 ? "s" : ""}</p>
                </div>

                {/* Distribution bars */}
                <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 5 }}>
                  {[5,4,3,2,1].map((star) => {
                    const count = reviewStats.dist?.[star - 1] ?? 0;
                    const pct   = reviewStats.total ? Math.round((count / reviewStats.total) * 100) : 0;
                    return (
                      <div key={star} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: c.muted, width: 20, textAlign: "right" }}>{star}★</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: isDarkMode ? "#1e2235" : "#f1f5f9", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "#f59e0b", borderRadius: 3, transition: "width 0.4s ease" }} />
                        </div>
                        <span style={{ fontSize: 11, color: c.muted, width: 28 }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent reviews list */}
              {reviews.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: c.muted, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Recent Reviews</p>
                  {reviews.slice(0, 5).map((r) => (
                    <div key={r._id} style={{ background: isDarkMode ? "rgba(255,255,255,0.03)" : "#f8f9ff", border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: r.comment ? 6 : 0 }}>
                        <div style={{ display: "flex", gap: 1 }}>
                          {[1,2,3,4,5].map((n) => (
                            <span key={n} style={{ fontSize: 13, color: n <= r.rating ? "#f59e0b" : (isDarkMode ? "#374151" : "#d1d5db") }}>★</span>
                          ))}
                        </div>
                        <span style={{ fontSize: 12, color: c.muted }}>
                          {r.studentId?.firstName} {r.studentId?.lastName} · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {r.comment && (
                        <p style={{ margin: 0, fontSize: 13, color: c.heading, lineHeight: 1.5 }}>"{r.comment}"</p>
                      )}
                    </div>
                  ))}
                  {reviews.length > 5 && (
                    <p style={{ fontSize: 12, color: c.muted, fontStyle: "italic", margin: 0 }}>
                      …and {reviews.length - 5} more review{reviews.length - 5 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Section>
      )}

    </div>
  );
}
