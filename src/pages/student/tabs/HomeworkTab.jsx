import { useState, useEffect, useRef } from "react";
import api from "../../../api";
import {
  BookOpen, Clock, CheckCircle2, Star, ChevronDown, ChevronUp,
  Paperclip, Upload, X, Send, AlertCircle, RefreshCw,
  FileText, Image, File, Award, Sparkles, Mic,
} from "lucide-react";
import { useGrammarCheck } from "../../../hooks/useGrammarCheck";
import ListenButton from "../../../components/ListenButton";

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
  assigned:  { label: "To Do",     emoji: "📝", color: "#7c3aed", bg: "#f5f3ff" },
  submitted: { label: "Submitted", emoji: "📤", color: "#d97706", bg: "#fffbeb" },
  graded:    { label: "Graded",    emoji: "🌟", color: "#059669", bg: "#ecfdf5" },
};

function FileIcon({ mimeType, size = 16 }) {
  if (mimeType?.startsWith("image/")) return <Image size={size} />;
  if (mimeType === "application/pdf")  return <FileText size={size} />;
  return <File size={size} />;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.assigned;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(d) {
  const diff = new Date(d) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function DuePill({ dueDate, status }) {
  if (status !== "assigned") return null;
  const days = daysUntil(dueDate);
  const overdue = days < 0;
  const urgent  = days >= 0 && days <= 2;
  const color   = overdue ? "#dc2626" : urgent ? "#d97706" : "#059669";
  const bg      = overdue ? "#fee2e2" : urgent ? "#fef3c7" : "#dcfce7";
  const label   = overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today!" : `${days}d left`;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, color, background: bg }}>
      {label}
    </span>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const pct   = score / 100;
  const r     = 28;
  const circ  = 2 * Math.PI * r;
  const dash  = pct * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={70} height={70} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={35} cy={35} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle cx={35} cy={35} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      <text x={35} y={35} textAnchor="middle" dominantBaseline="central"
        fill={color} fontWeight="800" fontSize={14}
        style={{ transform: "rotate(90deg)", transformOrigin: "35px 35px" }}>
        {score}
      </text>
    </svg>
  );
}

// ── File picker ───────────────────────────────────────────────────────────────
function FilePicker({ files, setFiles, accent }) {
  const inputRef = useRef(null);

  const addFiles = (newFiles) => {
    const valid = [];
    for (const f of newFiles) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        alert(`"${f.name}" is not allowed.\nAllowed: PDF, DOC, DOCX, JPG, PNG, TXT`);
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
        <button type="button" onClick={() => inputRef.current?.click()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 10, border: `2px dashed ${accent}`,
            background: "#fdf4ff", color: accent, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
          <Paperclip size={14} /> Attach files
        </button>
        <span style={{ fontSize: 11, color: "#9b8ab0" }}>PDF, DOC, DOCX, JPG, PNG, TXT · max 10 MB · up to {MAX_FILES}</span>
      </div>
      <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
        style={{ display: "none" }}
        onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#f5f3ff", border: `1px solid ${accent}40`, borderRadius: 8, padding: "4px 10px", fontSize: 12,
            }}>
              <FileIcon mimeType={f.type} size={13} />
              <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#4a4060" }}>
                {f.name}
              </span>
              <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9b8ab0", padding: 0, lineHeight: 1 }}>
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
export default function StudentHomeworkTab({ studentInfo, isDarkMode }) {
  const col = isDarkMode
    ? { bg: "#0f1117", card: "#1a1d2e", cardAlt: "#1f2235", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#6b7090", input: "#0f1117", inputBorder: "#475569" }
    : { bg: "#fff8f0", card: "#ffffff", cardAlt: "#fffbf5", border: "#ffe8cc", heading: "#2d1f6e", body: "#4a4060", muted: "#9b8ab0", input: "#fff", inputBorder: "#e2d9f3" };

  const accent = "#7c3aed";

  const [homeworkList, setHomeworkList] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState("all");
  const [expandedId,   setExpandedId]   = useState(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [toast,        setToast]        = useState(null);

  // Per-homework submission form state
  const [subForms, setSubForms] = useState({});   // { [hwId]: { text, files } }

  // Grammar checker — one shared instance for all homework boxes
  const { status: grammarStatus, suggestions: grammarSuggestions, check: grammarCheck } = useGrammarCheck();
  const [grammarHwId, setGrammarHwId] = useState(null); // which hw box is active

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchHomework = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/homework/assigned");
      setHomeworkList(data.homework || []);
    } catch {
      showToast("Failed to load homework", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHomework(); }, []);

  const getSubForm = (hwId) => subForms[hwId] || { text: "", files: [] };

  const setSubForm = (hwId, updater) => {
    setSubForms(prev => {
      const current = prev[hwId] || { text: "", files: [] };
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [hwId]: next };
    });
  };

  const filtered = homeworkList.filter(hw =>
    filter === "all" ? true : hw.status === filter
  );

  const counts = {
    all:       homeworkList.length,
    assigned:  homeworkList.filter(h => h.status === "assigned").length,
    submitted: homeworkList.filter(h => h.status === "submitted").length,
    graded:    homeworkList.filter(h => h.status === "graded").length,
  };

  const handleSubmit = async (hwId) => {
    const sf = getSubForm(hwId);
    if (!sf.text.trim() && sf.files.length === 0) {
      showToast("Please write something or attach a file", "error");
      return;
    }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("text", sf.text.trim());
      sf.files.forEach(f => fd.append("files", f));
      await api.post(`/api/homework/${hwId}/submit`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      showToast("Homework submitted! Great job! 🎉");
      setSubForms(prev => {
        const next = { ...prev };
        delete next[hwId];
        return next;
      });
      setExpandedId(null);
      fetchHomework();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to submit", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openFile = (type, fileId) => {
    api.get(`/api/homework/file/${type}/${fileId}`, { responseType: "blob" })
      .then(({ data }) => {
        const url = URL.createObjectURL(data);
        window.open(url, "_blank");
      })
      .catch(() => showToast("Could not open file", "error"));
  };

  // ── Stats row items ──────────────────────────────────────────────────────────
  const statsItems = [
    { key: "all",       label: "All Tasks",  emoji: "📚", color: "#7c3aed", bg: "#f5f3ff" },
    { key: "assigned",  label: "To Do",      emoji: "📝", color: "#d97706", bg: "#fffbeb" },
    { key: "submitted", label: "Submitted",  emoji: "📤", color: "#2563eb", bg: "#eff6ff" },
    { key: "graded",    label: "Graded",     emoji: "🌟", color: "#059669", bg: "#ecfdf5" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "'Nunito', sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          padding: "12px 22px", borderRadius: 14, fontWeight: 700, fontSize: 14,
          background: toast.type === "error" ? "#fee2e2" : "#dcfce7",
          color:      toast.type === "error" ? "#dc2626" : "#16a34a",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: col.heading }}>
            📚 My Homework
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: col.muted }}>
            Complete your assignments and earn stars!
          </p>
        </div>
        <button onClick={fetchHomework}
          style={{
            padding: "8px 16px", borderRadius: 12, border: `2px solid ${col.border}`,
            background: col.card, color: col.body, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700,
          }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {statsItems.map(({ key, label, emoji, color, bg }) => (
          <div key={key} onClick={() => setFilter(key)}
            style={{
              background: filter === key ? bg : col.card,
              border: `2.5px solid ${filter === key ? color : col.border}`,
              borderRadius: 16, padding: "14px 16px", cursor: "pointer",
              transition: "all 0.2s", textAlign: "center",
            }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{emoji}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color }}>{counts[key]}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["all", "assigned", "submitted", "graded"].map(f => {
          const cfg = STATUS_CONFIG[f] || { emoji: "📚", color: accent };
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 700,
                cursor: "pointer", transition: "all 0.15s",
                background: filter === f ? accent : col.card,
                color:      filter === f ? "#fff"  : col.body,
                boxShadow:  filter === f ? `0 2px 10px ${accent}50` : "none",
              }}>
              {f === "all" ? "📚 All" : `${cfg.emoji} ${cfg.label}`}
              {filter !== f && ` (${counts[f]})`}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: col.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <p style={{ fontWeight: 700 }}>Loading your homework…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 24px",
          background: col.card, borderRadius: 20,
          border: `2.5px dashed ${col.border}`,
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>
            {filter === "graded" ? "🏆" : filter === "submitted" ? "📤" : "🎉"}
          </div>
          <p style={{ fontWeight: 700, fontSize: 16, color: col.heading, margin: "0 0 4px" }}>
            {filter === "all"       ? "No homework yet!" :
             filter === "assigned"  ? "All caught up! No pending tasks." :
             filter === "submitted" ? "Nothing waiting to be graded." :
                                      "No graded homework yet."}
          </p>
          <p style={{ fontSize: 13, color: col.muted, margin: 0 }}>
            {filter === "all" ? "Your teacher hasn't assigned anything yet. Enjoy the free time!" : ""}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(hw => {
            const isExpanded = expandedId === hw._id;
            const sf         = getSubForm(hw._id);
            const teacher    = hw.teacherId;
            const score      = hw.grade?.score;

            return (
              <div key={hw._id} style={{
                background: col.card,
                border: `2.5px solid ${isExpanded ? accent : col.border}`,
                borderRadius: 18, overflow: "hidden",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxShadow: isExpanded ? `0 4px 20px ${accent}20` : "none",
              }}>
                {/* Card header */}
                <div onClick={() => setExpandedId(isExpanded ? null : hw._id)}
                  style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", padding: "16px 20px", cursor: "pointer",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                    {/* Icon bubble */}
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                      background: hw.status === "graded"
                        ? "linear-gradient(135deg,#10b981,#059669)"
                        : hw.status === "submitted"
                          ? "linear-gradient(135deg,#f59e0b,#d97706)"
                          : `linear-gradient(135deg,${accent},#a855f7)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                    }}>
                      {hw.status === "graded" ? "🌟" : hw.status === "submitted" ? "📤" : "📝"}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontWeight: 800, fontSize: 15, color: col.heading,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {hw.title}
                      </div>
                      <div style={{ fontSize: 12, color: col.muted, marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span>👩‍🏫 {teacher?.firstName} {teacher?.lastName}</span>
                        <span>·</span>
                        <span>Due {formatDate(hw.dueDate)}</span>
                        <DuePill dueDate={hw.dueDate} status={hw.status} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {hw.status === "graded" && score != null && (
                      <span style={{ fontWeight: 900, fontSize: 16, color: score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444" }}>
                        {score}/100
                      </span>
                    )}
                    <StatusBadge status={hw.status} />
                    {isExpanded ? <ChevronUp size={18} color={col.muted} /> : <ChevronDown size={18} color={col.muted} />}
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div style={{ borderTop: `2px solid ${col.border}`, padding: "20px", display: "flex", flexDirection: "column", gap: 18 }}>

                    {/* Instructions */}
                    {hw.description && (
                      <div style={{ background: isDarkMode ? "#1f2235" : "#faf5ff", borderRadius: 12, padding: 14, border: `1.5px solid ${isDarkMode ? "#2a2d40" : "#e9d5ff"}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Instructions
                          </div>
                          <ListenButton text={hw.description} />
                        </div>
                        <p style={{ margin: 0, fontSize: 14, color: col.heading, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                          {hw.description}
                        </p>
                      </div>
                    )}

                    {/* Teacher's files */}
                    {hw.attachments?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: col.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          📎 Reference Files from Teacher
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {hw.attachments.map(a => (
                            <button key={a.fileId} onClick={() => openFile("assignment", a.fileId)}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 7,
                                background: isDarkMode ? "#1f2235" : "#f5f3ff",
                                border: `1.5px solid ${isDarkMode ? "#2a2d40" : "#ddd6fe"}`,
                                borderRadius: 10, padding: "6px 14px", fontSize: 13, color: accent, cursor: "pointer", fontWeight: 600,
                              }}>
                              <FileIcon mimeType={a.mimeType} size={14} />
                              {a.originalName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Submitted work (read-only) */}
                    {(hw.status === "submitted" || hw.status === "graded") && hw.submission && (
                      <div style={{ background: isDarkMode ? "#1f2235" : "#fffbeb", borderRadius: 12, padding: 14, border: `1.5px solid ${isDarkMode ? "#2a2d40" : "#fde68a"}` }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#92400e", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          📤 Your Submission · {formatDate(hw.submission.submittedAt)}
                        </div>
                        {hw.submission.text && (
                          <p style={{ margin: "0 0 10px", fontSize: 14, color: col.heading, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                            {hw.submission.text}
                          </p>
                        )}
                        {hw.submission.attachments?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {hw.submission.attachments.map(a => (
                              <button key={a.fileId} onClick={() => openFile("submission", a.fileId)}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 7,
                                  background: "#fffbeb", border: "1.5px solid #fde68a",
                                  borderRadius: 10, padding: "6px 14px", fontSize: 13, color: "#92400e", cursor: "pointer", fontWeight: 600,
                                }}>
                                <FileIcon mimeType={a.mimeType} size={14} />
                                {a.originalName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Grade display */}
                    {hw.status === "graded" && hw.grade && (
                      <div style={{
                        background: isDarkMode ? "#1f2235" : "#f0fdf4",
                        borderRadius: 14, padding: "16px 20px",
                        border: "2px solid #86efac",
                        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
                      }}>
                        <ScoreRing score={hw.grade.score} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 16, color: "#065f46", marginBottom: 4 }}>
                            🎊 Great job! You scored {hw.grade.score}/100
                          </div>
                          {hw.grade.feedback && (
                            <p style={{ margin: 0, fontSize: 14, color: "#166534", lineHeight: 1.5 }}>
                              💬 {hw.grade.feedback}
                            </p>
                          )}
                          {hw.grade.audioFeedback?.fileId && (
                            <StudentAudioPlayer fileId={hw.grade.audioFeedback.fileId} duration={hw.grade.audioFeedback.duration} />
                          )}
                          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#4ade80" }}>
                            Graded on {formatDate(hw.grade.gradedAt)}
                          </p>
                        </div>
                        <div style={{ fontSize: 48 }}>
                          {hw.grade.score >= 90 ? "🏆" : hw.grade.score >= 75 ? "🥇" : hw.grade.score >= 60 ? "🥈" : "🥉"}
                        </div>
                      </div>
                    )}

                    {/* Submission form — only for "assigned" */}
                    {hw.status === "assigned" && (
                      <div style={{
                        background: isDarkMode ? "#1f2235" : "#faf5ff",
                        borderRadius: 14, padding: "16px 20px",
                        border: `2px solid ${accent}40`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: accent, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          ✏️ Submit Your Work
                        </div>

                        {/* Grammar status badge */}
                        {grammarHwId === hw._id && grammarStatus !== "idle" && (
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            marginBottom: 8, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: grammarStatus === "loading" ? "#fef3c7"
                              : grammarStatus === "checking" ? "#dbeafe"
                              : grammarStatus === "done" && grammarSuggestions.length === 0 ? "#dcfce7"
                              : grammarStatus === "done" ? "#fef3c7"
                              : grammarStatus === "error" ? "#fee2e2"
                              : "#f3f4f6",
                            color: grammarStatus === "loading" ? "#92400e"
                              : grammarStatus === "checking" ? "#1e40af"
                              : grammarStatus === "done" && grammarSuggestions.length === 0 ? "#166534"
                              : grammarStatus === "done" ? "#92400e"
                              : grammarStatus === "error" ? "#991b1b"
                              : "#374151",
                          }}>
                            {grammarStatus === "loading"  && "⏳ Loading grammar model (first time only)…"}
                            {grammarStatus === "checking" && "🔍 Checking grammar…"}
                            {grammarStatus === "ready"    && "✅ Grammar checker ready"}
                            {grammarStatus === "done" && grammarSuggestions.length === 0 && "✅ Grammar looks great!"}
                            {grammarStatus === "done" && grammarSuggestions.length > 0  && `⚠️ ${grammarSuggestions.length} suggestion${grammarSuggestions.length > 1 ? "s" : ""} found`}
                            {grammarStatus === "error"    && "⚠️ Grammar check unavailable"}
                          </div>
                        )}

                        <textarea
                          value={sf.text}
                          onChange={e => {
                            const val = e.target.value;
                            setSubForm(hw._id, f => ({ ...f, text: val }));
                            // Switch active grammar box — hook cancels any in-flight request
                            if (grammarHwId !== hw._id) setGrammarHwId(hw._id);
                            grammarCheck(val);
                          }}
                          placeholder="Write your answer here... 📖"
                          maxLength={5000}
                          rows={5}
                          style={{
                            width: "100%", padding: "12px 14px", borderRadius: 12,
                            border: `2px solid ${isDarkMode ? "#2a2d40" : "#ddd6fe"}`,
                            background: col.input, color: col.heading, fontSize: 14,
                            resize: "vertical", fontFamily: "'Nunito', sans-serif",
                            lineHeight: 1.6, boxSizing: "border-box", marginBottom: 8,
                          }} />

                        {/* Grammar suggestions panel */}
                        {grammarHwId === hw._id && grammarStatus === "done" && grammarSuggestions.length > 0 && (
                          <div style={{
                            background: isDarkMode ? "#1a1d2e" : "#fffbeb",
                            border: `1.5px solid ${isDarkMode ? "#44400e" : "#fde68a"}`,
                            borderRadius: 12, padding: "12px 14px", marginBottom: 12,
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#b45309", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              ✏️ Grammar Suggestions
                            </div>
                            {grammarSuggestions.map((s, i) => (
                              <div key={i} style={{ marginBottom: i < grammarSuggestions.length - 1 ? 10 : 0 }}>
                                {/* Original with changed words underlined in red */}
                                <div style={{ fontSize: 13, marginBottom: 3, lineHeight: 1.5 }}>
                                  {s.diff.map((w, wi) => (
                                    <span key={wi} style={{
                                      textDecoration: w.changed ? "underline wavy #ef4444" : "none",
                                      color: w.changed ? "#dc2626" : col.body,
                                      marginRight: wi < s.diff.length - 1 ? 4 : 0,
                                    }}>
                                      {w.word}
                                    </span>
                                  ))}{" "}
                                  <span style={{ fontSize: 11, color: col.muted }}>← original</span>
                                </div>
                                {/* Corrected version in green */}
                                <div style={{ fontSize: 13, color: "#16a34a", lineHeight: 1.5 }}>
                                  ✓ {s.corrected}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <FilePicker
                          files={sf.files}
                          setFiles={(updater) => setSubForm(hw._id, f => ({ ...f, files: typeof updater === "function" ? updater(f.files) : updater }))}
                          accent={accent}
                        />

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                          <button
                            onClick={() => handleSubmit(hw._id)}
                            disabled={submitting}
                            style={{
                              padding: "10px 28px", borderRadius: 12, border: "none",
                              background: `linear-gradient(135deg,${accent},#a855f7)`,
                              color: "#fff", fontWeight: 800, fontSize: 14,
                              cursor: submitting ? "not-allowed" : "pointer",
                              opacity: submitting ? 0.7 : 1,
                              display: "flex", alignItems: "center", gap: 8,
                              boxShadow: `0 4px 14px ${accent}40`,
                              fontFamily: "'Nunito', sans-serif",
                            }}>
                            <Send size={15} /> {submitting ? "Submitting…" : "Submit Homework 🚀"}
                          </button>
                        </div>
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


// ── Student audio feedback player ─────────────────────────────────────────────
function StudentAudioPlayer({ fileId, duration }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "linear-gradient(135deg,rgba(22,163,74,0.12),rgba(16,185,129,0.08))", borderRadius: 10, border: "1px solid #86efac", marginTop: 8 }}>
      {blobUrl && <audio ref={audioRef} src={blobUrl} onEnded={() => setPlaying(false)} style={{ display: "none" }} />}
      <Mic size={14} color="#16a34a" />
      <span style={{ fontSize: 12, fontWeight: 800, color: "#065f46", flex: 1 }}>Teacher's Voice Feedback</span>
      {duration > 0 && <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>{formatTime(duration)}</span>}
      <button onClick={load} disabled={loading}
        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}>
        {loading ? "Loading…" : playing ? "⏸ Pause" : "▶ Listen"}
      </button>
    </div>
  );
}
