import { useState, useEffect, useRef } from "react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import {
  Plus, BookOpen, Clock, CheckCircle2, Star, Trash2,
  ChevronDown, ChevronUp, Paperclip, Upload, X, Send,
  AlertCircle, RefreshCw, FileText, Image, File, Mic,
  Download,
} from "lucide-react";
import AudioRecorder from "../../../components/AudioRecorder";
import ManagedBadge from "../../../components/ManagedBadge";
import ShareLinkPanel from "../../../components/ShareLinkPanel";
import Pagination from "../../../components/Pagination";
import { downloadGradedHomeworkPdf } from "../../../utils/homeworkPdf";

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

// Center brand colour (set by utils/branding.js) — never hard-code a theme colour here
const BRAND  = "var(--brand-primary, #2563eb)";
const brandA = (a) => `rgba(var(--brand-primary-rgb, 37, 99, 235), ${a})`;

const STATUS_CONFIG = {
  assigned:  { label: "Assigned",  color: BRAND, bg: brandA(0.1) },
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
  // Use UTC so a dueDate stored as midnight UTC ("2026-04-05T00:00:00Z")
  // always displays as "5 Apr 2026", never shifts to the previous day.
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
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
            padding: "6px 14px", borderRadius: 8, border: `1.5px dashed ${brandA(0.45)}`,
            background: brandA(0.06), color: BRAND, fontSize: 13, fontWeight: 600,
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
  const [formFiles,         setFormFiles]         = useState([]);
  const [formInstructionAudio, setFormInstructionAudio] = useState(null); // { blob, duration }

  // Grade form state per homework ID
  const [gradeForms,   setGradeForms]   = useState({});
  // Audio blobs per homework ID: { [hwId]: { blob, duration } }
  const [audioBlobs,   setAudioBlobs]   = useState({});

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Paged on the server (20 per page) — counts per status come back with every page
  const [page,      setPage]      = useState(1);
  const [pager,     setPager]     = useState({ total: 0, totalPages: 1, limit: 20 });
  const [counts,    setCounts]    = useState({ all: 0, assigned: 0, submitted: 0, graded: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const changeFilter = (f) => { setFilter(f); setPage(1); };
  const fetchHomework = () => setReloadKey(k => k + 1);
  // Live: a student submits / attempts → this page refreshes quietly (no spinner)
  const quietRef = useRef(false);
  useOnDataChanged(["homework"], () => { quietRef.current = true; fetchHomework(); });

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        if (!quietRef.current) setLoading(true);
        quietRef.current = false;
        const { data } = await api.get("/homework/my", { params: { status: filter === "all" ? undefined : filter, page } });
        if (stale) return;
        setHomeworkList(data.homework || []);
        if (data.counts) setCounts(data.counts);
        if (data.pagination) { setPager(data.pagination); if (data.pagination.page !== page) setPage(data.pagination.page); }
      } catch {
        if (!stale) showToast("Failed to load homework", "error");
      } finally {
        if (!stale) setLoading(false);
      }
    })();
    return () => { stale = true; };
  }, [page, filter, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = homeworkList; // already filtered + paged by the server


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

      const { data: created } = await api.post("/homework", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const forManaged = !!created.homework?.shareToken;

      // Upload instruction voice note if recorded
      if (formInstructionAudio?.blob) {
        const afd = new FormData();
        afd.append("audio", formInstructionAudio.blob, "instruction.webm");
        afd.append("duration", String(formInstructionAudio.duration));
        await api.post(`/homework/${created.homework._id}/instruction-audio`, afd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      showToast(forManaged ? "Homework created — copy the link below and send it to the parent" : "Homework assigned!");
      setShowForm(false);
      setForm({ studentId: "", title: "", description: "", dueDate: "" });
      setFormFiles([]);
      setFormInstructionAudio(null);
      await fetchHomework();
      // Open the new card so the teacher sees the share link straight away
      if (forManaged) { changeFilter("all"); setExpandedId(created.homework._id); }
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
        await api.post(`/homework/${hwId}/audio-feedback`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      await api.post(`/homework/${hwId}/grade`, {
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
      await api.delete(`/homework/${hwId}`);
      showToast("Deleted");
      setHomeworkList(prev => prev.filter(h => h._id !== hwId));
      fetchHomework();
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  // ── Share link: create / delete ─────────────────────────────────────────────
  const replaceHw = (updated) =>
    setHomeworkList(prev => prev.map(h => (h._id === updated._id ? { ...h, ...updated, studentId: h.studentId } : h)));

  const handleCreateLink = async (hwId) => {
    try {
      const { data } = await api.post(`/homework/${hwId}/share-link`);
      replaceHw(data.homework);
      showToast("New link created");
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not create link", "error");
    }
  };

  const handleDeleteLink = async (hwId) => {
    try {
      await api.delete(`/homework/${hwId}/share-link`);
      setHomeworkList(prev => prev.map(h => (h._id === hwId ? { ...h, shareToken: null, shareLink: undefined } : h)));
      showToast("Link deleted — it no longer works");
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not delete link", "error");
    }
  };

  const [pdfBusy, setPdfBusy] = useState(null);
  const handleDownloadPdf = async (hw) => {
    setPdfBusy(hw._id);
    try { await downloadGradedHomeworkPdf(hw, teacherInfo); }
    catch (err) { console.error("PDF error:", err); showToast("Could not create PDF", "error"); }
    finally { setPdfBusy(null); }
  };

  const fileUrl = (type, fileId) =>
    `${API_BASE}/api/homework/file/${type}/${fileId}`;

  const token = localStorage.getItem("token");

  const openFile = (type, fileId) => {
    // Open through the authenticated download endpoint using a token in the URL
    // (since we can't set headers on <a> tags, we fetch as blob)
    api.get(`/homework/file/${type}/${fileId}`, { responseType: "blob" })
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
            style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: BRAND, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Assign Homework
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { key: "all",       label: "Total",     icon: BookOpen,     color: BRAND },
          { key: "assigned",  label: "Pending",   icon: Clock,        color: "#f59e0b" },
          { key: "submitted", label: "To Review",  icon: AlertCircle,  color: "#3b82f6" },
          { key: "graded",    label: "Graded",    icon: CheckCircle2, color: "#10b981" },
        ].map(({ key, label, icon: Icon, color }) => (
          <div key={key}
            onClick={() => changeFilter(key)}
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
        <div style={{ background: c.card, border: `2px solid ${BRAND}`, borderRadius: 16, padding: 24 }}>
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
                      {s.firstName} {s.lastName}{s.isManaged ? " · Managed (link)" : ""}
                    </option>
                  ))}
                </select>
                {(students || []).find(s => (s._id || s.id) === form.studentId)?.isManaged && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: BRAND, fontWeight: 600 }}>
                    This student has no login — you'll get a link to send to the parent.
                  </p>
                )}
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

            {/* Instruction voice note */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>
                Voice Instructions (optional)
              </label>
              <AudioRecorder
                isDarkMode={isDarkMode}
                label={null}
                recordLabel="Record instructions"
                onRecorded={(blob, duration) =>
                  setFormInstructionAudio(blob ? { blob, duration } : null)
                }
              />
              {formInstructionAudio?.blob && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: BRAND, fontWeight: 600 }}>
                  ✓ Voice note recorded — will be attached to instructions
                </p>
              )}
            </div>

            <FilePicker files={formFiles} setFiles={setFormFiles} label="Attach reference files" />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: "9px 20px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.card, color: c.body, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                style={{ padding: "9px 24px", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                <Send size={13} /> {submitting ? "Assigning…" : "Assign"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {["all", "assigned", "submitted", "graded"].map(f => (
          <button key={f} onClick={() => changeFilter(f)}
            style={{
              padding: "6px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              background: filter === f ? BRAND : c.card,
              color:      filter === f ? "#fff"    : c.body,
              boxShadow:  filter === f ? `0 2px 8px ${brandA(0.25)}` : "none",
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
        <div style={{ textAlign: "center", padding: "48px 24px", background: c.card, borderRadius: "16px", border: `1px solid ${c.border}` }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "20px",
            background: isDarkMode ? brandA(0.15) : brandA(0.08),
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <BookOpen size={28} color="var(--brand-primary)" />
          </div>
          <p style={{ fontSize: "16px", fontWeight: "700", color: c.heading, margin: "0 0 8px" }}>
            {filter === "all" ? "No homework yet" : `No ${filter} homework`}
          </p>
          <p style={{ fontSize: "13.5px", color: c.body, margin: 0 }}>
            {filter === "all" ? "Assign homework to your students to track their progress" : `No homework with status "${filter}" found`}
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
                background: c.card, border: `2px solid ${isExpanded ? BRAND : c.border}`,
                borderRadius: 14, overflow: "hidden", transition: "border-color 0.15s",
              }}>
                {/* Card header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : hw._id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: BRAND, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <BookOpen size={18} color="#fff" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {hw.title}
                      </div>
                      <div style={{ fontSize: 12, color: c.body, marginTop: 2 }}>
                        {student?.firstName} {student?.lastName}
                        {student?.isManaged && <ManagedBadge isDarkMode={isDarkMode} style={{ marginLeft: 6 }} />}
                        {" "}·{" "}
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

                    {/* Share link — managed students only, until graded */}
                    {student?.isManaged && hw.status !== "graded" && (
                      <ShareLinkPanel
                        item={hw}
                        kind="homework"
                        isDarkMode={isDarkMode}
                        onCreate={() => handleCreateLink(hw._id)}
                        onDelete={() => handleDeleteLink(hw._id)}
                        notify={showToast}
                      />
                    )}

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
                          {hw.submission?.via === "link" && " · via link"}
                        </div>
                        {hw.submission?.text && (
                          <p style={{ margin: "0 0 10px", fontSize: 13, color: c.heading, whiteSpace: "pre-wrap" }}>
                            {hw.submission.text}
                          </p>
                        )}
                        {hw.submission?.audio?.fileId && (
                          <div style={{ marginBottom: 10 }}>
                            <AudioFeedbackPlayer fileId={hw.submission.audio.fileId} duration={hw.submission.audio.duration}
                              type="submission-audio" label="Student's voice answer" />
                          </div>
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
                        <button type="button" onClick={() => handleDownloadPdf(hw)} disabled={pdfBusy === hw._id}
                          style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #6ee7b7", background: "#fff", color: "#065f46", fontWeight: 700, fontSize: 12, cursor: pdfBusy === hw._id ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                          <Download size={13} /> {pdfBusy === hw._id ? "Creating PDF…" : "Download PDF for parent"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <Pagination page={page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit}
          onPage={(p) => { setPage(p); setExpandedId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} isDarkMode={isDarkMode} />
      )}
    </div>
  );
}

// ── Audio feedback player (used in graded section) ────────────────────────────
function AudioFeedbackPlayer({ fileId, duration, type = "audio-feedback", label = "Voice Feedback" }) {
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
      const { data } = await api.get(`/homework/file/${type}/${fileId}`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      setBlobUrl(url);
      setTimeout(() => { audioRef.current?.play(); setPlaying(true); }, 50);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else         { audioRef.current.play().catch(() => {});  setPlaying(true);  }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: brandA(0.08), borderRadius: 8, marginTop: 6 }}>
      {blobUrl && <audio ref={audioRef} src={blobUrl} onEnded={() => setPlaying(false)} style={{ display: "none" }} />}
      <button type="button" onClick={load} disabled={loading}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, border: "none", background: BRAND, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
        <Mic size={12} />
        {loading ? "Loading…" : playing ? "⏸ Pause" : `▶ ${label}`}
      </button>
      {duration > 0 && <span style={{ fontSize: 11, color: BRAND, fontWeight: 700 }}>{formatTime(duration)}</span>}
    </div>
  );
}
