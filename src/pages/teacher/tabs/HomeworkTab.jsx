import { useState, useEffect, useRef } from "react";
import api from "../../../api";
import {
  Plus, BookOpen, Clock, CheckCircle2, Star, Trash2,
  ChevronDown, ChevronUp, Paperclip, Upload, X, Send,
  AlertCircle, RefreshCw, FileText, Image, File, Mic,
} from "lucide-react";
import AudioRecorder from "../../../components/AudioRecorder";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES     = 5;

const STATUS_CONFIG = {
  assigned:  { label: "Assigned",  color: "#6366f1", bg: "#eef2ff" },
  submitted: { label: "Submitted", color: "#f59e0b", bg: "#fffbeb" },
  graded:    { label: "Graded",    color: "#10b981", bg: "#ecfdf5" },
};

function FileIcon({ mimeType, size = 16 }) {
  if (mimeType?.startsWith("image/")) return <Image size={size} />;
  if (mimeType === "application/pdf") return <FileText size={size} />;
  return <File size={size} />;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.assigned;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
    }}>
      {status === "assigned"  && <Clock size={11} />}
      {status === "submitted" && <AlertCircle size={11} />}
      {status === "graded"    && <CheckCircle2 size={11} />}
      {cfg.label}
    </span>
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(dueDate, status) {
  return status === "assigned" && new Date(dueDate) < new Date();
}

// ── File picker component ─────────────────────────────────────────────────────
function FilePicker({ files, setFiles, label = "Attach files" }) {
  const inputRef = useRef(null);

  const addFiles = (newFiles) => {
    const valid = [];
    for (const f of newFiles) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        alert(`"${f.name}" is not an allowed file type.\nAllowed: PDF, DOC, DOCX, JPG, PNG, TXT`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        alert(`"${f.name}" exceeds the 10 MB limit.`);
        continue;
      }
      valid.push(f);
    }
    setFiles(prev => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        alert(`Maximum ${MAX_FILES} files allowed.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8, border: "1.5px dashed #a5b4fc",
            background: "#f5f3ff", color: "#6366f1", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}>
          <Paperclip size={14} /> {label}
        </button>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>PDF, DOC, DOCX, JPG, PNG, TXT · max 10 MB · up to {MAX_FILES}</span>
      </div>
      <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
        style={{ display: "none" }}
        onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#f1f5f9", border: "1px solid #e2e8f0",
              borderRadius: 8, padding: "4px 10px", fontSize: 12,
            }}>
              <FileIcon mimeType={f.type} size={13} />
              <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.name}
              </span>
              <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, lineHeight: 1 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HomeworkTab({ teacherInfo, students, isDarkMode }) {
  const c = isDarkMode
    ? { bg: "#0f172a", card: "#1e293b", border: "#334155", heading: "#f1f5f9", body: "#94a3b8", input: "#0f172a", inputBorder: "#475569" }
    : { bg: "#f8fafc", card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#64748b", input: "#fff", inputBorder: "#e2e8f0" };

  const [homeworkList, setHomeworkList]   = useState([]);
  const [loading,      setLoading]        = useState(true);
  const [filter,       setFilter]         = useState("all");
  const [expandedId,   setExpandedId]     = useState(null);
  const [showForm,     setShowForm]       = useState(false);
  const [submitting,   setSubmitting]     = useState(false);
  const [grading,      setGrading]        = useState({});
  const [toast,        setToast]          = useState(null);

  // Form state
  const [form, setForm] = useState({
    studentId: "", title: "", description: "", dueDate: "",
  });
  const [formFiles, setFormFiles] = useState([]);

  // Grade form state per homework ID
  const [gradeForms,   setGradeForms]   = useState({});
  // Audio blobs per homework ID: { [hwId]: { blob, duration } }
  const [audioBlobs,   setAudioBlobs]   = useState({});

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchHomework = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/homework/my");
      setHomeworkList(data.homework || []);
    } catch {
      showToast("Failed to load homework", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHomework(); }, []);

  const filtered = homeworkList.filter(hw =>
    filter === "all" ? true : hw.status === filter
  );

  const counts = {
    all:       homeworkList.length,
    assigned:  homeworkList.filter(h => h.status === "assigned").length,
    submitted: homeworkList.filter(h => h.status === "submitted").length,
    graded:    homeworkList.filter(h => h.status === "graded").length,
  };

  // ── Create homework ─────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.studentId || !form.title.trim() || !form.dueDate) {
      showToast("Please fill in all required fields", "error");
      return;
    }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("studentId",   form.studentId);
      fd.append("title",       form.title.trim());
      fd.append("description", form.description.trim());
      fd.append("dueDate",     form.dueDate);
      formFiles.forEach(f => fd.append("files", f));

      await api.post("/api/homework", fd, { headers: { "Content-Type": "multipart/form-data" } });
      showToast("Homework assigned!");
      setShowForm(false);
      setForm({ studentId: "", title: "", description: "", dueDate: "" });
      setFormFiles([]);
      fetchHomework();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to assign homework", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Grade submission ────────────────────────────────────────────────────────
  const handleGrade = async (hwId) => {
    const gf = gradeForms[hwId] || {};
    if (gf.score === "" || gf.score == null) {
      showToast("Please enter a score", "error");
      return;
    }
    try {
      setGrading(prev => ({ ...prev, [hwId]: true }));

      // Upload audio feedback first if recorded
      const ab = audioBlobs[hwId];
      if (ab?.blob) {
        const form = new FormData();
        form.append("audio", ab.blob, "feedback.webm");
        form.append("duration", String(ab.duration));
        await api.post(`/api/homework/${hwId}/audio-feedback`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      await api.post(`/api/homework/${hwId}/grade`, {
        score:    gf.score,
        feedback: gf.feedback || "",
      });
      showToast("Graded successfully!");
      setExpandedId(null);
      setAudioBlobs(prev => { const n = { ...prev }; delete n[hwId]; return n; });
      fetchHomework();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to grade", "error");
    } finally {
      setGrading(prev => ({ ...prev, [hwId]: false }));
    }
  };

  // ── Delete homework ─────────────────────────────────────────────────────────
  const handleDelete = async (hwId) => {
    if (!window.confirm("Delete this homework and all files?")) return;
    try {
      await api.delete(`/api/homework/${hwId}`);
      showToast("Deleted");
      setHomeworkList(prev => prev.filter(h => h._id !== hwId));
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const fileUrl = (type, fileId) =>
    `${API_BASE}/api/homework/file/${type}/${fileId}`;

  const token = localStorage.getItem("token");

  const openFile = (type, fileId) => {
    // Open through the authenticated download endpoint using a token in the URL
    // (since we can't set headers on <a> tags, we fetch as blob)
    api.get(`/api/homework/file/${type}/${fileId}`, { responseType: "blob" })
      .then(({ data, headers }) => {
        const url = URL.createObjectURL(data);
        window.open(url, "_blank");
      })
      .catch(() => showToast("Could not open file", "error"));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14,
          background: toast.type === "error" ? "#fee2e2" : "#dcfce7",
          color:      toast.type === "error" ? "#dc2626" : "#16a34a",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c.heading }}>Homework</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: c.body }}>Assign, review and grade student work</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchHomework}
            style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.card, color: c.body, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowForm(v => !v)}
            style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Assign Homework
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { key: "all",       label: "Total",     icon: BookOpen,     color: "#6366f1" },
          { key: "assigned",  label: "Pending",   icon: Clock,        color: "#f59e0b" },
          { key: "submitted", label: "To Review",  icon: AlertCircle,  color: "#3b82f6" },
          { key: "graded",    label: "Graded",    icon: CheckCircle2, color: "#10b981" },
        ].map(({ key, label, icon: Icon, color }) => (
          <div key={key}
            onClick={() => setFilter(key)}
            style={{
              background: c.card, border: `2px solid ${filter === key ? color : c.border}`,
              borderRadius: 14, padding: "14px 18px", cursor: "pointer",
              transition: "all 0.15s",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Icon size={16} color={color} />
              <span style={{ fontSize: 12, fontWeight: 600, color: c.body }}>{label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>{counts[key]}</div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: c.card, border: `2px solid #6366f1`, borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: c.heading }}>
            Assign New Homework
          </h3>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>
                  Student *
                </label>
                <select
                  value={form.studentId}
                  onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                  required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${c.inputBorder}`, background: c.input, color: c.heading, fontSize: 13 }}>
                  <option value="">Select student…</option>
                  {(students || []).map(s => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.firstName} {s.surname || s.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>
                  Due Date *
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                  required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${c.inputBorder}`, background: c.input, color: c.heading, fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Write a paragraph about your favourite season"
                maxLength={200}
                required
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${c.inputBorder}`, background: c.input, color: c.heading, fontSize: 13, boxSizing: "border-box" }} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>
                Instructions
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Add any instructions, hints or context for the student…"
                maxLength={2000}
                rows={3}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${c.inputBorder}`, background: c.input, color: c.heading, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <FilePicker files={formFiles} setFiles={setFormFiles} label="Attach reference files" />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: "9px 20px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.card, color: c.body, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                style={{ padding: "9px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                <Send size={13} /> {submitting ? "Assigning…" : "Assign"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {["all", "assigned", "submitted", "graded"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: "6px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              background: filter === f ? "#6366f1" : c.card,
              color:      filter === f ? "#fff"    : c.body,
              boxShadow:  filter === f ? "0 2px 8px #6366f140" : "none",
            }}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {filter !== f && `(${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Homework list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: c.body }}>
          <RefreshCw size={28} style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ marginTop: 12 }}>Loading homework…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: c.card, borderRadius: 16, border: `2px dashed ${c.border}` }}>
          <BookOpen size={48} color={c.body} style={{ opacity: 0.4 }} />
          <p style={{ marginTop: 12, color: c.body, fontWeight: 600 }}>
            {filter === "all" ? "No homework assigned yet. Click 'Assign Homework' to get started!" : `No ${filter} homework.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(hw => {
            const isExpanded = expandedId === hw._id;
            const overdue    = isOverdue(hw.dueDate, hw.status);
            const gf         = gradeForms[hw._id] || { score: "", feedback: "" };
            const student    = hw.studentId;

            return (
              <div key={hw._id} style={{
                background: c.card, border: `2px solid ${isExpanded ? "#6366f1" : c.border}`,
                borderRadius: 14, overflow: "hidden", transition: "border-color 0.15s",
              }}>
                {/* Card header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : hw._id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <BookOpen size={18} color="#fff" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {hw.title}
                      </div>
                      <div style={{ fontSize: 12, color: c.body, marginTop: 2 }}>
                        {student?.firstName} {student?.surname || student?.lastName} ·{" "}
                        <span style={{ color: overdue ? "#ef4444" : c.body }}>
                          Due {formatDate(hw.dueDate)}{overdue ? " — Overdue" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <StatusBadge status={hw.status} />
                    {hw.status === "assigned" && (
                      <button onClick={e => { e.stopPropagation(); handleDelete(hw._id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={18} color={c.body} /> : <ChevronDown size={18} color={c.body} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${c.border}`, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* Description */}
                    {hw.description && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: c.body, marginBottom: 4 }}>INSTRUCTIONS</div>
                        <p style={{ margin: 0, fontSize: 13, color: c.heading, whiteSpace: "pre-wrap" }}>{hw.description}</p>
                      </div>
                    )}

                    {/* Teacher attachments */}
                    {hw.attachments?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: c.body, marginBottom: 6 }}>REFERENCE FILES</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {hw.attachments.map(a => (
                            <button key={a.fileId} onClick={() => openFile("assignment", a.fileId)}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8,
                                padding: "5px 12px", fontSize: 12, color: "#475569", cursor: "pointer",
                              }}>
                              <FileIcon mimeType={a.mimeType} size={13} />
                              {a.originalName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Student submission */}
                    {(hw.status === "submitted" || hw.status === "graded") && (
                      <div style={{ background: isDarkMode ? "#0f172a" : "#f8fafc", borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: c.body, marginBottom: 8 }}>
                          STUDENT SUBMISSION · {formatDate(hw.submission?.submittedAt)}
                        </div>
                        {hw.submission?.text && (
                          <p style={{ margin: "0 0 10px", fontSize: 13, color: c.heading, whiteSpace: "pre-wrap" }}>
                            {hw.submission.text}
                          </p>
                        )}
                        {hw.submission?.attachments?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {hw.submission.attachments.map(a => (
                              <button key={a.fileId} onClick={() => openFile("submission", a.fileId)}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
                                  padding: "5px 12px", fontSize: 12, color: "#92400e", cursor: "pointer",
                                }}>
                                <FileIcon mimeType={a.mimeType} size={13} />
                                {a.originalName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Grade form — only for submitted */}
                    {hw.status === "submitted" && (
                      <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 14, border: "1px solid #bbf7d0" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 10 }}>GRADE THIS SUBMISSION</div>
                        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                          <div style={{ flex: "0 0 100px" }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#166534", display: "block", marginBottom: 4 }}>SCORE (0–100)</label>
                            <input
                              type="number" min="0" max="100"
                              value={gf.score}
                              onChange={e => setGradeForms(prev => ({ ...prev, [hw._id]: { ...gf, score: e.target.value } }))}
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #86efac", fontSize: 14, fontWeight: 700, boxSizing: "border-box" }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#166534", display: "block", marginBottom: 4 }}>FEEDBACK</label>
                            <input
                              type="text"
                              placeholder="Great work! Next time try to…"
                              value={gf.feedback}
                              onChange={e => setGradeForms(prev => ({ ...prev, [hw._id]: { ...gf, feedback: e.target.value } }))}
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #86efac", fontSize: 13, boxSizing: "border-box" }} />
                          </div>
                        </div>
                        {/* Audio recorder */}
                        <div style={{ marginBottom: 10 }}>
                          <AudioRecorder
                            isDarkMode={isDarkMode}
                            onRecorded={(blob, duration) =>
                              setAudioBlobs(prev => blob
                                ? { ...prev, [hw._id]: { blob, duration } }
                                : { ...prev, [hw._id]: null }
                              )
                            }
                          />
                        </div>

                        <button onClick={() => handleGrade(hw._id)} disabled={grading[hw._id]}
                          style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: grading[hw._id] ? "not-allowed" : "pointer", opacity: grading[hw._id] ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                          {audioBlobs[hw._id]?.blob ? <Mic size={13} /> : <Star size={13} />}
                          {grading[hw._id] ? "Saving…" : audioBlobs[hw._id]?.blob ? "Submit Grade + Voice" : "Submit Grade"}
                        </button>
                      </div>
                    )}

                    {/* Existing grade */}
                    {hw.status === "graded" && (
                      <div style={{ background: "#ecfdf5", borderRadius: 12, padding: 14, border: "1px solid #6ee7b7" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46", marginBottom: 6 }}>GRADE</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <div style={{ fontSize: 32, fontWeight: 900, color: "#059669" }}>{hw.grade?.score}<span style={{ fontSize: 16 }}>/100</span></div>
                          {hw.grade?.feedback && <p style={{ margin: 0, fontSize: 13, color: "#065f46" }}>{hw.grade.feedback}</p>}
                        </div>
                        {hw.grade?.audioFeedback?.fileId && (
                          <AudioFeedbackPlayer fileId={hw.grade.audioFeedback.fileId} duration={hw.grade.audioFeedback.duration} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Audio feedback player (used in graded section) ────────────────────────────
function AudioFeedbackPlayer({ fileId, duration }) {
  const [blobUrl,  setBlobUrl]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [playing,  setPlaying]  = useState(false);
  const audioRef = useRef(null);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;

  const load = async () => {
    if (blobUrl) { togglePlay(); return; }
    setLoading(true);
    try {
      const { default: api } = await import("../../../api");
      const { data } = await api.get(`/api/homework/file/audio-feedback/${fileId}`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      setBlobUrl(url);
      setTimeout(() => { audioRef.current?.play(); setPlaying(true); }, 50);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else         { audioRef.current.play();  setPlaying(true);  }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(22,163,74,0.1)", borderRadius: 8, marginTop: 6 }}>
      {blobUrl && <audio ref={audioRef} src={blobUrl} onEnded={() => setPlaying(false)} style={{ display: "none" }} />}
      <button onClick={load} disabled={loading}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
        <Mic size={12} />
        {loading ? "Loading…" : playing ? "⏸ Pause" : "▶ Voice Feedback"}
      </button>
      {duration > 0 && <span style={{ fontSize: 11, color: "#065f46", fontWeight: 700 }}>{formatTime(duration)}</span>}
    </div>
  );
}
