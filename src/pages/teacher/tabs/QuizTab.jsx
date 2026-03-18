import { useState, useEffect, useRef } from "react";
import api from "../../../api";
import {
  Plus, Trash2, ChevronDown, ChevronUp, RefreshCw,
  Clock, CheckCircle2, BookOpen, Send, Shuffle,
  X, Check, Save, FolderOpen, Star, Sparkles, Loader,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  assigned:  { label: "Not Attempted", color: "#7c3aed", bg: "#f5f3ff" },
  attempted: { label: "Attempted",     color: "#059669", bg: "#ecfdf5" },
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function blankQuestion() {
  return { question: "", options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }], correctIndex: 0, explanation: "" };
}

function shuffle(arr) {
  const a = arr.map((q, i) => ({ ...q, _origIdx: i }));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.map(({ _origIdx, ...rest }) => rest);
}

function ScoreBar({ percentage }) {
  const color = percentage >= 80 ? "#10b981" : percentage >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${percentage}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontWeight: 800, fontSize: 14, color }}>{percentage}%</span>
    </div>
  );
}

// ── Question builder ──────────────────────────────────────────────────────────
function QuestionBuilder({ questions, setQuestions, isDarkMode }) {
  const bg    = isDarkMode ? "#0f172a" : "#f8fafc";
  const bdr   = isDarkMode ? "#334155" : "#e2e8f0";
  const txtcl = isDarkMode ? "#f1f5f9" : "#1e293b";

  const addQuestion  = () => { if (questions.length < 50) setQuestions(p => [...p, blankQuestion()]); };
  const removeQuestion = (i) => setQuestions(p => p.filter((_, j) => j !== i));
  const updateQ      = (i, field, val) => setQuestions(p => p.map((q, j) => j === i ? { ...q, [field]: val } : q));
  const updateOption = (qi, oi, val)   => setQuestions(p => p.map((q, j) =>
    j === qi ? { ...q, options: q.options.map((o, k) => k === oi ? { text: val } : o) } : q));
  const addOption    = (qi) => setQuestions(p => p.map((q, j) =>
    j === qi && q.options.length < 4 ? { ...q, options: [...q.options, { text: "" }] } : q));
  const removeOption = (qi, oi) => setQuestions(p => p.map((q, j) => {
    if (j !== qi || q.options.length <= 2) return q;
    const opts = q.options.filter((_, k) => k !== oi);
    return { ...q, options: opts, correctIndex: q.correctIndex >= opts.length ? 0 : q.correctIndex };
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {questions.map((q, qi) => (
        <div key={qi} style={{ background: bg, border: `1.5px solid ${bdr}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ background: "#7c3aed", color: "#fff", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              {qi + 1}
            </span>
            <input value={q.question} onChange={e => updateQ(qi, "question", e.target.value)}
              placeholder={`Question ${qi + 1}…`} maxLength={1000}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${bdr}`, fontSize: 13, background: isDarkMode ? "#1e293b" : "#fff", color: txtcl }} />
            <button type="button" onClick={() => removeQuestion(qi)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4, flexShrink: 0 }}>
              <Trash2 size={15} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 32 }}>
            {q.options.map((opt, oi) => (
              <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" onClick={() => updateQ(qi, "correctIndex", oi)} title="Mark correct"
                  style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${q.correctIndex === oi ? "#10b981" : bdr}`, background: q.correctIndex === oi ? "#10b981" : isDarkMode ? "#1e293b" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  {q.correctIndex === oi && <Check size={12} color="#fff" />}
                </button>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", width: 14, flexShrink: 0 }}>{String.fromCharCode(65 + oi)}.</span>
                <input value={opt.text} onChange={e => updateOption(qi, oi, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + oi)}`} maxLength={500}
                  style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${q.correctIndex === oi ? "#86efac" : bdr}`, fontSize: 13, background: q.correctIndex === oi ? (isDarkMode ? "#1a3a2a" : "#f0fdf4") : (isDarkMode ? "#1e293b" : "#fff"), color: txtcl }} />
                {q.options.length > 2 && (
                  <button type="button" onClick={() => removeOption(qi, oi)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2, flexShrink: 0 }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            {q.options.length < 4 && (
              <button type="button" onClick={() => addOption(qi)}
                style={{ alignSelf: "flex-start", padding: "4px 12px", borderRadius: 8, border: "1.5px dashed #a5b4fc", background: isDarkMode ? "#1e1b4b" : "#f5f3ff", color: "#7c3aed", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + Add option
              </button>
            )}
            <input value={q.explanation} onChange={e => updateQ(qi, "explanation", e.target.value)}
              placeholder="Explanation (shown after submission, optional)" maxLength={500}
              style={{ marginTop: 4, padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${bdr}`, fontSize: 12, color: "#64748b", background: isDarkMode ? "#1e293b" : "#fff" }} />
          </div>
        </div>
      ))}

      <button type="button" onClick={addQuestion} disabled={questions.length >= 50}
        style={{ padding: 10, borderRadius: 12, border: "2px dashed #a5b4fc", background: isDarkMode ? "#1e1b4b" : "#f5f3ff", color: "#7c3aed", fontWeight: 700, fontSize: 13, cursor: questions.length >= 50 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Plus size={15} /> Add Question {questions.length > 0 && `(${questions.length}/50)`}
      </button>
    </div>
  );
}

// ── Result viewer ─────────────────────────────────────────────────────────────
function ResultViewer({ quiz, attempt, c }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "14px 18px", border: "1.5px solid #86efac" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#065f46", marginBottom: 8 }}>RESULT</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: attempt.percentage >= 80 ? "#10b981" : attempt.percentage >= 60 ? "#f59e0b" : "#ef4444" }}>
            {attempt.score}/{attempt.totalQuestions}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <ScoreBar percentage={attempt.percentage} />
            <div style={{ fontSize: 12, color: "#166534", marginTop: 4 }}>
              Submitted {formatDate(attempt.submittedAt)}
              {attempt.timeTaken != null && ` · ${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s`}
            </div>
          </div>
        </div>
      </div>
      {quiz.questions.map((q, i) => {
        const studentAns = attempt.answers[i];
        const correct    = studentAns === q.correctIndex;
        return (
          <div key={i} style={{ background: correct ? "#f0fdf4" : "#fef2f2", border: `1.5px solid ${correct ? "#86efac" : "#fca5a5"}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ background: correct ? "#10b981" : "#ef4444", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
                {correct ? "✓" : "✗"}
              </span>
              Q{i + 1}: {q.question}
            </div>
            {q.options.map((opt, oi) => (
              <div key={oi} style={{ padding: "5px 10px", borderRadius: 6, marginBottom: 3, fontSize: 12, background: oi === q.correctIndex ? "#dcfce7" : oi === studentAns && !correct ? "#fee2e2" : "transparent", fontWeight: oi === q.correctIndex || oi === studentAns ? 700 : 400, color: oi === q.correctIndex ? "#166534" : oi === studentAns && !correct ? "#991b1b" : "#475569" }}>
                {String.fromCharCode(65 + oi)}. {opt.text}
                {oi === q.correctIndex && " ✓"}
                {oi === studentAns && !correct && " ← student's answer"}
              </div>
            ))}
            {q.explanation && <div style={{ marginTop: 6, fontSize: 12, color: "#475569", fontStyle: "italic" }}>💡 {q.explanation}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Template picker modal ─────────────────────────────────────────────────────
function TemplatePicker({ templates, onLoad, onClose, isDarkMode }) {
  const [doShuffle, setDoShuffle] = useState(false);
  const [search,    setSearch]    = useState("");

  const shown = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const bg  = isDarkMode ? "#1e293b" : "#fff";
  const bdr = isDarkMode ? "#334155" : "#e2e8f0";
  const txt = isDarkMode ? "#f1f5f9" : "#1e293b";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: bg, borderRadius: 20, padding: 28, width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: txt }}>📁 Load Template</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{templates.length} saved template{templates.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}><X size={20} /></button>
        </div>

        {/* Shuffle toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${doShuffle ? "#7c3aed" : bdr}`, background: doShuffle ? (isDarkMode ? "#1e1b4b" : "#f5f3ff") : "transparent", cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={doShuffle} onChange={e => setDoShuffle(e.target.checked)} style={{ accentColor: "#7c3aed", width: 16, height: 16 }} />
          <Shuffle size={15} color="#7c3aed" />
          <span style={{ fontWeight: 700, fontSize: 13, color: txt }}>Shuffle question order when loading</span>
        </label>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search templates…"
          style={{ padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${bdr}`, fontSize: 13, background: isDarkMode ? "#0f172a" : "#f8fafc", color: txt }} />

        {/* List */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No templates found</div>
          ) : shown.map(t => (
            <button key={t._id} onClick={() => onLoad(t, doShuffle)}
              style={{ textAlign: "left", padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${bdr}`, background: isDarkMode ? "#0f172a" : "#f8fafc", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: txt, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 12 }}>
                <span>📋 {t.questions.length} questions</span>
                <span>⏱ {t.timeLimit} min</span>
                <span>🔄 Used {t.usageCount} time{t.usageCount !== 1 ? "s" : ""}</span>
                <span>Saved {formatDate(t.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Save-as-template modal ────────────────────────────────────────────────────
function SaveTemplateModal({ onSave, onClose, isDarkMode, defaultName }) {
  const [name, setName] = useState(defaultName || "");
  const bg  = isDarkMode ? "#1e293b" : "#fff";
  const bdr = isDarkMode ? "#334155" : "#e2e8f0";
  const txt = isDarkMode ? "#f1f5f9" : "#1e293b";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: bg, borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: txt }}>💾 Save as Template</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b" }}>Give this set of questions a name so you can reuse it later.</p>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>Template Name *</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={200}
          placeholder="e.g. Unit 3 – Past Simple (v1)"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${bdr}`, fontSize: 14, background: isDarkMode ? "#0f172a" : "#f8fafc", color: txt, boxSizing: "border-box", marginBottom: 18 }} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: `1.5px solid ${bdr}`, background: "transparent", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            style={{ padding: "9px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: name.trim() ? "pointer" : "not-allowed", opacity: name.trim() ? 1 : 0.5 }}>
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Saved templates panel ─────────────────────────────────────────────────────
function TemplatesPanel({ templates, onLoad, onDelete, isDarkMode, c }) {
  const [search, setSearch] = useState("");
  const shown = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ background: c.card, border: `2px solid ${c.border}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: c.heading }}>📁 Saved Templates</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: c.body }}>{templates.length} template{templates.length !== 1 ? "s" : ""} in your library</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          style={{ padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${c.border}`, fontSize: 13, background: c.input || "#fff", color: c.heading, width: 180 }} />
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: c.body, fontSize: 13 }}>
          {templates.length === 0 ? "No templates saved yet. Create a quiz and save it as a template!" : "No matching templates."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map(t => (
            <div key={t._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${c.border}`, background: isDarkMode ? "#0f172a" : "#f8fafc" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: c.body, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>📋 {t.questions.length} questions</span>
                  <span>⏱ {t.timeLimit} min</span>
                  <span>🔄 Used {t.usageCount}×</span>
                  <span>{formatDate(t.createdAt)}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onLoad(t, false)}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <FolderOpen size={13} /> Use
                </button>
                <button onClick={() => onLoad(t, true)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${c.border}`, background: "transparent", color: "#7c3aed", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Shuffle size={13} /> Shuffled
                </button>
                <button onClick={() => onDelete(t._id)}
                  style={{ padding: "6px 8px", borderRadius: 8, border: `1.5px solid ${c.border}`, background: "transparent", color: "#ef4444", cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function QuizTab({ teacherInfo, students, isDarkMode }) {
  const c = isDarkMode
    ? { bg: "#0f172a", card: "#1e293b", border: "#334155", heading: "#f1f5f9", body: "#94a3b8", input: "#0f172a", inputBorder: "#475569" }
    : { bg: "#f8fafc", card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#64748b", input: "#fff", inputBorder: "#e2e8f0" };

  const [quizzes,          setQuizzes]          = useState([]);
  const [templates,        setTemplates]        = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [showForm,         setShowForm]         = useState(false);
  const [showTemplates,    setShowTemplates]    = useState(false);
  const [showPicker,       setShowPicker]       = useState(false);
  const [showSaveModal,    setShowSaveModal]    = useState(false);
  const [submitting,       setSubmitting]       = useState(false);
  const [savingTemplate,   setSavingTemplate]   = useState(false);
  const [filter,           setFilter]           = useState("all");
  const [expandedId,       setExpandedId]       = useState(null);
  const [toast,            setToast]            = useState(null);

  const [form, setForm] = useState({ studentId: "", title: "", instructions: "", timeLimit: "15", dueDate: "" });
  const [questions, setQuestions] = useState([blankQuestion()]);

  // AI generator state
  const [showAI,       setShowAI]       = useState(false);
  const [aiMode,       setAiMode]       = useState("topic"); // "topic" | "notes"
  const [aiTopic,      setAiTopic]      = useState("");
  const [aiCount,      setAiCount]      = useState("10");
  const [aiDifficulty, setAiDifficulty] = useState("intermediate");
  const [aiLoading,    setAiLoading]    = useState(false);
  // Notes mode
  const [aiNotes,      setAiNotes]      = useState("");
  const [aiPdfFile,    setAiPdfFile]    = useState(null);  // File object
  const aiFileRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/quiz/my");
      setQuizzes(data.quizzes || []);
    } catch { showToast("Failed to load quizzes", "error"); }
    finally { setLoading(false); }
  };

  const fetchTemplates = async () => {
    try {
      const { data } = await api.get("/api/quiz-templates");
      setTemplates(data.templates || []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchQuizzes(); fetchTemplates(); }, []);

  const counts = {
    all:       quizzes.length,
    assigned:  quizzes.filter(q => q.status === "assigned").length,
    attempted: quizzes.filter(q => q.status === "attempted").length,
  };
  const filtered = quizzes.filter(q => filter === "all" || q.status === filter);

  // ── Load template into form ────────────────────────────────────────────────
  const handleLoadTemplate = (tmpl, doShuffle) => {
    const qs = doShuffle ? shuffle(tmpl.questions) : tmpl.questions.map(q => ({ ...q }));
    setForm(f => ({
      ...f,
      title:        f.title || tmpl.name,
      instructions: f.instructions || tmpl.instructions,
      timeLimit:    String(tmpl.timeLimit),
    }));
    setQuestions(qs);
    setShowPicker(false);
    setShowForm(true);
    // Increment usage count silently
    api.patch(`/api/quiz-templates/${tmpl._id}/use`).then(() => fetchTemplates()).catch(() => {});
    showToast(`Loaded "${tmpl.name}"${doShuffle ? " (shuffled)" : ""}`);
  };

  // ── Save current questions as template ────────────────────────────────────
  const handleSaveTemplate = async (name) => {
    const invalid = questions.some(q => !q.question.trim() || q.options.some(o => !o.text.trim()));
    if (invalid) { showToast("All questions and options must have text before saving", "error"); return; }
    try {
      setSavingTemplate(true);
      await api.post("/api/quiz-templates", {
        name,
        instructions: form.instructions,
        timeLimit:    parseInt(form.timeLimit, 10) || 15,
        questions,
      });
      showToast(`Template "${name}" saved!`);
      setShowSaveModal(false);
      fetchTemplates();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save template", "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Shuffle current questions in form ─────────────────────────────────────
  const handleShuffleQuestions = () => {
    setQuestions(prev => shuffle(prev));
    showToast("Questions reshuffled!");
  };

  // ── Generate questions with Gemini AI ─────────────────────────────────────
  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) { showToast("Please enter a topic first", "error"); return; }
    try {
      setAiLoading(true);
      const { data } = await api.post("/api/quiz/generate", {
        topic:      aiTopic.trim(),
        count:      parseInt(aiCount, 10),
        difficulty: aiDifficulty,
      });
      if (!data.success) throw new Error(data.message);
      if (!Array.isArray(data.questions) || data.questions.length === 0)
        throw new Error("AI returned no questions — please try again");
      setQuestions(data.questions);
      if (!form.title.trim()) setForm(f => ({ ...f, title: aiTopic.trim() }));
      setShowAI(false);
      showToast(`✨ ${data.generated} questions generated!`);
    } catch (err) {
      showToast(err?.response?.data?.message || err.message || "AI generation failed", "error");
    } finally {
      setAiLoading(false);
    }
  };

  // ── Generate questions from lesson notes / PDF (Claude Sonnet) ───────────
  const handleNotesGenerate = async () => {
    if (!aiNotes.trim() && !aiPdfFile) {
      showToast("Paste your lesson notes or upload a PDF first", "error");
      return;
    }
    try {
      setAiLoading(true);
      const fd = new FormData();
      if (aiNotes.trim()) fd.append("notes", aiNotes.trim());
      if (aiPdfFile)       fd.append("file",  aiPdfFile);
      fd.append("count", aiCount);

      const { data } = await api.post("/api/quiz/generate-from-notes", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!data.success) throw new Error(data.message);
      if (!Array.isArray(data.questions) || data.questions.length === 0)
        throw new Error("AI returned no questions — please try again");

      setQuestions(data.questions);
      // Auto-fill title from first few words of notes
      if (!form.title.trim()) {
        const titleHint = aiPdfFile
          ? aiPdfFile.name.replace(/\.pdf$/i, "")
          : aiNotes.trim().split(/\s+/).slice(0, 5).join(" ");
        setForm(f => ({ ...f, title: titleHint }));
      }
      setShowAI(false);
      showToast(`✨ ${data.generated} questions generated from your notes!`);
    } catch (err) {
      showToast(err?.response?.data?.message || err.message || "Generation failed", "error");
    } finally {
      setAiLoading(false);
    }
  };

  // ── Delete template ───────────────────────────────────────────────────────
  const handleDeleteTemplate = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await api.delete(`/api/quiz-templates/${id}`);
      setTemplates(prev => prev.filter(t => t._id !== id));
      showToast("Template deleted");
    } catch { showToast("Failed to delete", "error"); }
  };

  // ── Publish quiz ──────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.studentId || !form.title.trim() || !form.timeLimit || !form.dueDate) {
      showToast("Please fill in all required fields", "error");
      return;
    }
    const invalid = questions.some(q => !q.question.trim() || q.options.some(o => !o.text.trim()));
    if (invalid) { showToast("All questions and options must have text", "error"); return; }
    try {
      setSubmitting(true);
      await api.post("/api/quiz", {
        studentId:    form.studentId,
        title:        form.title.trim(),
        instructions: form.instructions.trim(),
        timeLimit:    parseInt(form.timeLimit, 10),
        dueDate:      form.dueDate,
        questions,
      });
      showToast("Quiz assigned!");
      setShowForm(false);
      setForm({ studentId: "", title: "", instructions: "", timeLimit: "15", dueDate: "" });
      setQuestions([blankQuestion()]);
      fetchQuizzes();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create quiz", "error");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this quiz?")) return;
    try {
      await api.delete(`/api/quiz/${id}`);
      showToast("Quiz deleted");
      setQuizzes(prev => prev.filter(q => q._id !== id));
    } catch (err) { showToast(err?.response?.data?.message || "Failed to delete", "error"); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, background: toast.type === "error" ? "#fee2e2" : "#dcfce7", color: toast.type === "error" ? "#dc2626" : "#16a34a", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {showPicker && (
        <TemplatePicker templates={templates} onLoad={handleLoadTemplate} onClose={() => setShowPicker(false)} isDarkMode={isDarkMode} />
      )}
      {showSaveModal && (
        <SaveTemplateModal defaultName={form.title} onSave={handleSaveTemplate} onClose={() => setShowSaveModal(false)} isDarkMode={isDarkMode} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c.heading }}>Quiz / MCQ Tests</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: c.body }}>Create timed tests · save and reuse question templates</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={fetchQuizzes}
            style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.card, color: c.body, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowTemplates(v => !v)}
            style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${templates.length > 0 ? "#7c3aed" : c.border}`, background: templates.length > 0 ? (isDarkMode ? "#1e1b4b" : "#f5f3ff") : c.card, color: templates.length > 0 ? "#7c3aed" : c.body, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
            <FolderOpen size={14} /> Templates {templates.length > 0 && `(${templates.length})`}
          </button>
          <button onClick={() => setShowForm(v => !v)}
            style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Create Quiz
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { key: "all",       label: "Total",     icon: BookOpen,     color: "#7c3aed" },
          { key: "assigned",  label: "Pending",   icon: Clock,        color: "#f59e0b" },
          { key: "attempted", label: "Completed", icon: CheckCircle2, color: "#10b981" },
        ].map(({ key, label, icon: Icon, color }) => (
          <div key={key} onClick={() => setFilter(key)}
            style={{ background: c.card, border: `2px solid ${filter === key ? color : c.border}`, borderRadius: 14, padding: "14px 18px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Icon size={16} color={color} />
              <span style={{ fontSize: 12, fontWeight: 600, color: c.body }}>{label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>{counts[key]}</div>
          </div>
        ))}
      </div>

      {/* Templates panel */}
      {showTemplates && (
        <TemplatesPanel
          templates={templates}
          onLoad={(t, doShuffle) => { handleLoadTemplate(t, doShuffle); setShowTemplates(false); }}
          onDelete={handleDeleteTemplate}
          isDarkMode={isDarkMode}
          c={c}
        />
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ background: c.card, border: "2px solid #7c3aed", borderRadius: 16, padding: 24 }}>
          {/* Form header with template actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: c.heading }}>Create New Quiz</h3>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Load from template */}
              <button type="button" onClick={() => setShowPicker(true)}
                style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #7c3aed", background: isDarkMode ? "#1e1b4b" : "#f5f3ff", color: "#7c3aed", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <FolderOpen size={13} /> Load Template
              </button>
              {/* Shuffle current */}
              {questions.length > 1 && (
                <button type="button" onClick={handleShuffleQuestions}
                  style={{ padding: "7px 14px", borderRadius: 9, border: `1.5px solid ${c.border}`, background: "transparent", color: c.body, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Shuffle size={13} /> Reshuffle
                </button>
              )}
              {/* Save as template */}
              <button type="button" onClick={() => setShowSaveModal(true)}
                style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #10b981", background: isDarkMode ? "#1a3a2a" : "#f0fdf4", color: "#059669", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Save size={13} /> Save as Template
              </button>
              {/* AI Generate */}
              <button type="button" onClick={() => setShowAI(v => !v)}
                style={{ padding: "7px 14px", borderRadius: 9, border: `1.5px solid ${showAI ? "#f97316" : "#f97316"}`, background: showAI ? "linear-gradient(135deg,#f97316,#fb923c)" : (isDarkMode ? "rgba(249,115,22,0.1)" : "#fff7ed"), color: showAI ? "#fff" : "#f97316", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Sparkles size={13} /> ✨ AI Generate
              </button>
            </div>
          </div>

          {/* ── AI Generator Panel ──────────────────────────────────────────── */}
          {showAI && (
            <div style={{ background: isDarkMode ? "rgba(249,115,22,0.08)" : "#fff7ed", border: "2px solid #fed7aa", borderRadius: 14, padding: 18, marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Sparkles size={16} color="#f97316" />
                <span style={{ fontWeight: 800, fontSize: 14, color: c.heading }}>Generate Questions with AI</span>
              </div>

              {/* Mode tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16, background: isDarkMode ? "#1a1d2e" : "#fff", borderRadius: 10, padding: 4, width: "fit-content", border: `1.5px solid #fed7aa` }}>
                {[
                  { key: "topic", label: "📝 From Topic", sub: "Gemini · Free" },
                  { key: "notes", label: "📄 From Lesson Notes", sub: "Claude · Smarter" },
                ].map(m => (
                  <button key={m.key} type="button" onClick={() => setAiMode(m.key)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "none",
                      background: aiMode === m.key ? "linear-gradient(135deg,#f97316,#fb923c)" : "transparent",
                      color: aiMode === m.key ? "#fff" : c.body,
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                    }}>
                    <span>{m.label}</span>
                    <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 600 }}>{m.sub}</span>
                  </button>
                ))}
              </div>

              {/* ── Topic mode ── */}
              {aiMode === "topic" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px", gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#f97316", display: "block", marginBottom: 5 }}>Topic *</label>
                      <input value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !aiLoading && handleAIGenerate()}
                        placeholder='e.g. "past tense verbs"'
                        maxLength={200}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #fed7aa", background: c.input, color: c.heading, fontSize: 13, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#f97316", display: "block", marginBottom: 5 }}>Questions</label>
                      <select value={aiCount} onChange={e => setAiCount(e.target.value)}
                        style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1.5px solid #fed7aa", background: c.input, color: c.heading, fontSize: 13 }}>
                        {[5, 8, 10, 15, 20].map(n => <option key={n} value={n}>{n} Qs</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#f97316", display: "block", marginBottom: 5 }}>Level</label>
                      <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)}
                        style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1.5px solid #fed7aa", background: c.input, color: c.heading, fontSize: 13 }}>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button type="button" onClick={handleAIGenerate} disabled={aiLoading || !aiTopic.trim()}
                      style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: aiLoading || !aiTopic.trim() ? "#e5e7eb" : "linear-gradient(135deg,#f97316,#fb923c)", color: aiLoading || !aiTopic.trim() ? "#9ca3af" : "#fff", fontWeight: 700, fontSize: 13, cursor: aiLoading || !aiTopic.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                      {aiLoading ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Sparkles size={13} /> Generate Questions</>}
                    </button>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {questions.length > 0 && questions[0].question ? "⚠️ This will replace your current questions" : "Questions will appear below"}
                    </span>
                  </div>
                </>
              )}

              {/* ── Notes mode ── */}
              {aiMode === "notes" && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#f97316", display: "block", marginBottom: 5 }}>
                      Upload PDF <span style={{ fontWeight: 500, color: "#94a3b8" }}>— or paste notes below (or both)</span>
                    </label>

                    {/* PDF drop zone */}
                    <div
                      onClick={() => aiFileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") setAiPdfFile(f); }}
                      style={{
                        border: `2px dashed ${aiPdfFile ? "#f97316" : "#fed7aa"}`,
                        borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                        background: aiPdfFile ? (isDarkMode ? "rgba(249,115,22,0.1)" : "#fff7ed") : "transparent",
                        display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                      }}>
                      <span style={{ fontSize: 22 }}>{aiPdfFile ? "📄" : "⬆️"}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.heading }}>
                          {aiPdfFile ? aiPdfFile.name : "Click or drag a PDF here"}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {aiPdfFile ? `${(aiPdfFile.size / 1024).toFixed(0)} KB` : "Max 10 MB · PDF only"}
                        </div>
                      </div>
                      {aiPdfFile && (
                        <button type="button" onClick={e => { e.stopPropagation(); setAiPdfFile(null); }}
                          style={{ marginLeft: "auto", background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
                      )}
                    </div>
                    <input ref={aiFileRef} type="file" accept=".pdf" style={{ display: "none" }}
                      onChange={e => { if (e.target.files[0]) setAiPdfFile(e.target.files[0]); e.target.value = ""; }} />

                    {/* Paste notes */}
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#f97316", display: "block", marginBottom: 5 }}>
                      Paste lesson notes
                    </label>
                    <textarea
                      value={aiNotes}
                      onChange={e => setAiNotes(e.target.value)}
                      placeholder="Paste your lesson notes, vocabulary lists, grammar rules, or any text you taught this session…"
                      rows={5}
                      maxLength={20000}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #fed7aa", background: c.input, color: c.heading, fontSize: 13, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
                    />
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, textAlign: "right" }}>
                      {aiNotes.length.toLocaleString()} / 20,000 chars
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#f97316", display: "block", marginBottom: 5 }}>Questions</label>
                      <select value={aiCount} onChange={e => setAiCount(e.target.value)}
                        style={{ padding: "9px 10px", borderRadius: 9, border: "1.5px solid #fed7aa", background: c.input, color: c.heading, fontSize: 13 }}>
                        {[5, 8, 10, 15, 20].map(n => <option key={n} value={n}>{n} Qs</option>)}
                      </select>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", paddingTop: 20, flex: 1 }}>
                      🤖 Claude will read your notes and write questions about exactly what you taught
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button type="button" onClick={handleNotesGenerate}
                      disabled={aiLoading || (!aiNotes.trim() && !aiPdfFile)}
                      style={{
                        padding: "9px 22px", borderRadius: 10, border: "none",
                        background: aiLoading || (!aiNotes.trim() && !aiPdfFile) ? "#e5e7eb" : "linear-gradient(135deg,#7c3aed,#a855f7)",
                        color: aiLoading || (!aiNotes.trim() && !aiPdfFile) ? "#9ca3af" : "#fff",
                        fontWeight: 700, fontSize: 13,
                        cursor: aiLoading || (!aiNotes.trim() && !aiPdfFile) ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: 7,
                      }}>
                      {aiLoading
                        ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Reading notes…</>
                        : <><Sparkles size={13} /> Generate from Notes</>}
                    </button>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {questions.length > 0 && questions[0].question ? "⚠️ This will replace current questions" : ""}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Row 1: student + due date */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>Student *</label>
                <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${c.inputBorder}`, background: c.input, color: c.heading, fontSize: 13 }}>
                  <option value="">Select student…</option>
                  {(students || []).map(s => (
                    <option key={s._id || s.id} value={s._id || s.id}>{s.firstName} {s.surname || s.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>Due Date *</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]} required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${c.inputBorder}`, background: c.input, color: c.heading, fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Row 2: title + time limit */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 14, alignItems: "end" }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>Quiz Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Unit 3 — Past Simple Tense" maxLength={200} required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${c.inputBorder}`, background: c.input, color: c.heading, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>
                  <Clock size={12} style={{ display: "inline", marginRight: 4 }} />Time Limit *
                </label>
                <div style={{ position: "relative" }}>
                  <input type="number" value={form.timeLimit} onChange={e => setForm(f => ({ ...f, timeLimit: e.target.value }))}
                    min="1" max="300" required
                    style={{ width: "100%", padding: "9px 40px 9px 12px", borderRadius: 10, border: "1.5px solid #7c3aed", background: c.input, color: c.heading, fontSize: 14, fontWeight: 700, boxSizing: "border-box" }} />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#7c3aed", fontWeight: 700, pointerEvents: "none" }}>min</span>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: c.body, display: "block", marginBottom: 6 }}>Instructions (optional)</label>
              <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                placeholder="Read each question carefully. You have one attempt." maxLength={2000} rows={2}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${c.inputBorder}`, background: c.input, color: c.heading, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            {/* Questions */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: c.body }}>
                  Questions * — <span style={{ fontWeight: 400 }}>green circle = correct answer</span>
                </label>
                {questions.length > 1 && (
                  <button type="button" onClick={handleShuffleQuestions}
                    style={{ padding: "4px 12px", borderRadius: 8, border: `1.5px solid ${c.border}`, background: "transparent", color: c.body, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Shuffle size={12} /> Reshuffle order
                  </button>
                )}
              </div>
              <QuestionBuilder questions={questions} setQuestions={setQuestions} isDarkMode={isDarkMode} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: "9px 20px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.card, color: c.body, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                style={{ padding: "9px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                <Send size={13} /> {submitting ? "Publishing…" : `Publish Quiz (${questions.length} Q)`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {["all", "assigned", "attempted"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "6px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: filter === f ? "#7c3aed" : c.card, color: filter === f ? "#fff" : c.body, boxShadow: filter === f ? "0 2px 8px #7c3aed40" : "none" }}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {filter !== f && `(${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Quiz list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: c.body }}>
          <RefreshCw size={28} style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ marginTop: 12 }}>Loading quizzes…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: c.card, borderRadius: 16, border: `2px dashed ${c.border}` }}>
          <BookOpen size={48} color={c.body} style={{ opacity: 0.4, margin: "0 auto" }} />
          <p style={{ marginTop: 12, color: c.body, fontWeight: 600 }}>
            {filter === "all" ? "No quizzes yet. Click 'Create Quiz' to get started!" : `No ${filter} quizzes.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(quiz => {
            const isExpanded = expandedId === quiz._id;
            const student    = quiz.studentId;
            const cfg        = STATUS_CONFIG[quiz.status] || STATUS_CONFIG.assigned;
            return (
              <div key={quiz._id} style={{ background: c.card, border: `2px solid ${isExpanded ? "#7c3aed" : c.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div onClick={() => setExpandedId(isExpanded ? null : quiz._id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: quiz.status === "attempted" ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#7c3aed,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      {quiz.status === "attempted" ? "✅" : "📝"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: c.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quiz.title}</div>
                      <div style={{ fontSize: 12, color: c.body, marginTop: 2 }}>
                        {student?.firstName} {student?.surname || student?.lastName} · {quiz.questions.length} Qs · ⏱ {quiz.timeLimit} min · Due {formatDate(quiz.dueDate)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {quiz.attempt && (
                      <span style={{ fontWeight: 800, fontSize: 14, color: quiz.attempt.percentage >= 80 ? "#10b981" : quiz.attempt.percentage >= 60 ? "#f59e0b" : "#ef4444" }}>
                        {quiz.attempt.score}/{quiz.attempt.totalQuestions}
                      </span>
                    )}
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                    {quiz.status === "assigned" && (
                      <button onClick={e => { e.stopPropagation(); handleDelete(quiz._id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={18} color={c.body} /> : <ChevronDown size={18} color={c.body} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${c.border}`, padding: "16px 18px" }}>
                    {quiz.status === "attempted" && quiz.attempt ? (
                      <ResultViewer quiz={quiz} attempt={quiz.attempt} c={c} />
                    ) : (
                      <div>
                        {quiz.instructions && (
                          <p style={{ margin: "0 0 12px", fontSize: 13, color: c.body, fontStyle: "italic" }}>{quiz.instructions}</p>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {quiz.questions.map((q, i) => (
                            <div key={i} style={{ padding: "10px 12px", background: isDarkMode ? "#0f172a" : "#f8fafc", borderRadius: 10, border: `1px solid ${c.border}` }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: c.heading, marginBottom: 6 }}>Q{i + 1}: {q.question}</div>
                              {q.options.map((opt, oi) => (
                                <div key={oi} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, marginBottom: 2, background: oi === q.correctIndex ? "#dcfce7" : "transparent", color: oi === q.correctIndex ? "#166534" : c.body, fontWeight: oi === q.correctIndex ? 700 : 400 }}>
                                  {String.fromCharCode(65 + oi)}. {opt.text} {oi === q.correctIndex && "✓"}
                                </div>
                              ))}
                            </div>
                          ))}
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

// Inject spin keyframe once for the AI loading icon
const _spinStyle = document.createElement("style");
_spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
if (!document.head.querySelector("[data-quiz-anim]")) {
  _spinStyle.setAttribute("data-quiz-anim", "1");
  document.head.appendChild(_spinStyle);
}
