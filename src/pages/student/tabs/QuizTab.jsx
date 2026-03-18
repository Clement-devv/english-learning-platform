import { useState, useEffect, useRef, useCallback } from "react";
import api from "../../../api";
import {
  Clock, CheckCircle2, RefreshCw, BookOpen,
  AlertTriangle, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Send,
} from "lucide-react";
import ListenButton from "../../../components/ListenButton";

const LS_KEY = (quizId) => `quiz_start_${quizId}`;

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(d) {
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
}

// ── Countdown display ─────────────────────────────────────────────────────────
function Countdown({ secondsLeft, totalSeconds }) {
  const pct      = secondsLeft / totalSeconds;
  const mins     = Math.floor(secondsLeft / 60);
  const secs     = secondsLeft % 60;
  const critical = secondsLeft <= 60;
  const warning  = secondsLeft <= totalSeconds * 0.25;

  const color = critical ? "#ef4444" : warning ? "#f59e0b" : "#10b981";
  const r     = 38;
  const circ  = 2 * Math.PI * r;
  const dash  = pct * circ;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={92} height={92} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={46} cy={46} r={r} fill="none" stroke={critical ? "#fee2e2" : warning ? "#fef3c7" : "#dcfce7"} strokeWidth={7} />
        <circle cx={46} cy={46} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.5s" }} />
      </svg>
      <div style={{
        position: "relative", top: -72, fontWeight: 900, fontSize: 20,
        color, fontVariantNumeric: "tabular-nums",
        animation: critical ? "pulse 1s ease-in-out infinite" : "none",
      }}>
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      <div style={{ position: "relative", top: -68, fontSize: 11, fontWeight: 700, color: "#9b8ab0" }}>
        {critical ? "HURRY!" : "REMAINING"}
      </div>
    </div>
  );
}

// ── Active quiz screen ────────────────────────────────────────────────────────
function QuizScreen({ quiz, onComplete, isDarkMode }) {
  const col = isDarkMode
    ? { bg: "#0f1117", card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#6b7090" }
    : { bg: "#fff8f0", card: "#ffffff", border: "#e5e7ef", heading: "#2d1f6e", body: "#4a4060", muted: "#9b8ab0" };

  const totalSeconds = quiz.timeLimit * 60;

  // Restore or record start time from localStorage
  const [startedAt] = useState(() => {
    const saved = localStorage.getItem(LS_KEY(quiz._id));
    if (saved) return new Date(saved);
    const now = new Date();
    localStorage.setItem(LS_KEY(quiz._id), now.toISOString());
    return now;
  });

  const elapsed      = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const initialSecs  = Math.max(totalSeconds - elapsed, 0);

  const [secondsLeft, setSecondsLeft] = useState(initialSecs);
  const [answers,     setAnswers]     = useState(() => new Array(quiz.questions.length).fill(-1));
  const [current,     setCurrent]     = useState(0);
  const [submitting,  setSubmitting]  = useState(false);
  const timerRef      = useRef(null);
  const answersRef    = useRef(answers);   // always holds latest answers for timer callback
  const submittingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { answersRef.current    = answers;    }, [answers]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);

  const submit = useCallback(async (forcedAnswers) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    clearInterval(timerRef.current);
    const finalAnswers = forcedAnswers ?? answersRef.current;
    const timeTaken    = totalSeconds - secondsLeft;
    try {
      const { data } = await api.post(`/api/quiz/${quiz._id}/attempt`, {
        answers:   finalAnswers,
        startedAt: startedAt.toISOString(),
        timeTaken,
      });
      localStorage.removeItem(LS_KEY(quiz._id));
      onComplete(data.quiz, data.attempt);
    } catch (err) {
      alert(err?.response?.data?.message || "Submission failed. Please try again.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [quiz._id, secondsLeft, startedAt, totalSeconds, onComplete]);

  // Countdown tick
  useEffect(() => {
    if (secondsLeft <= 0) { submit(); return; }
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit when reaches 0
  useEffect(() => {
    if (secondsLeft === 0 && !submittingRef.current) submit();
  }, [secondsLeft, submit]);

  const q           = quiz.questions[current];
  const answered    = answers.filter(a => a !== -1).length;
  const total       = quiz.questions.length;
  const allAnswered = answered === total;

  const selectAnswer = (optIndex) => {
    setAnswers(prev => {
      const next = [...prev];
      next[current] = optIndex;
      return next;
    });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: isDarkMode ? "#0f1117" : "#f3f0ff",
      display: "flex", flexDirection: "column",
      fontFamily: "'Nunito', sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        background: isDarkMode ? "#1a1d2e" : "#fff",
        borderBottom: `2px solid ${isDarkMode ? "#2a2d40" : "#e9d5ff"}`,
        padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: isDarkMode ? "#f0f4ff" : "#2d1f6e" }}>
            📝 {quiz.title}
          </div>
          <div style={{ fontSize: 12, color: isDarkMode ? "#6b7090" : "#9b8ab0", marginTop: 2 }}>
            Question {current + 1} of {total} · {answered}/{total} answered
          </div>
        </div>

        {/* Timer */}
        <Countdown secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: isDarkMode ? "#2a2d40" : "#e9d5ff" }}>
        <div style={{
          height: "100%", width: `${((current + 1) / total) * 100}%`,
          background: "linear-gradient(90deg,#7c3aed,#a855f7)", transition: "width 0.3s",
        }} />
      </div>

      {/* Question dots */}
      <div style={{ display: "flex", gap: 6, padding: "12px 24px", overflowX: "auto", flexShrink: 0 }}>
        {quiz.questions.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)}
            style={{
              width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
              flexShrink: 0, fontWeight: 800, fontSize: 12,
              background: i === current
                ? "linear-gradient(135deg,#7c3aed,#a855f7)"
                : answers[i] !== -1
                  ? (isDarkMode ? "#1e3a2f" : "#dcfce7")
                  : (isDarkMode ? "#2a2d40" : "#f3f0ff"),
              color: i === current ? "#fff" : answers[i] !== -1 ? "#166534" : isDarkMode ? "#6b7090" : "#7c3aed",
              boxShadow: i === current ? "0 2px 10px #7c3aed50" : "none",
            }}>
            {answers[i] !== -1 ? "✓" : i + 1}
          </button>
        ))}
      </div>

      {/* Question */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
        <div style={{
          maxWidth: 700, margin: "0 auto",
          background: isDarkMode ? "#1a1d2e" : "#fff",
          borderRadius: 20, padding: "24px 28px",
          border: `2px solid ${isDarkMode ? "#2a2d40" : "#e9d5ff"}`,
          boxShadow: "0 4px 24px rgba(124,58,237,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: isDarkMode ? "#f0f4ff" : "#2d1f6e", lineHeight: 1.5, flex: 1 }}>
              {q.question}
            </div>
            <ListenButton text={q.question} style={{ marginTop: 2 }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {q.options.map((opt, oi) => {
              const selected = answers[current] === oi;
              return (
                <button key={oi} onClick={() => selectAnswer(oi)}
                  style={{
                    width: "100%", textAlign: "left", padding: "14px 18px",
                    borderRadius: 14,
                    border: `2.5px solid ${selected ? "#7c3aed" : isDarkMode ? "#2a2d40" : "#e9d5ff"}`,
                    background: selected
                      ? (isDarkMode ? "#2d1f4a" : "#f5f0ff")
                      : (isDarkMode ? "#1f2235" : "#fafafa"),
                    color: selected ? (isDarkMode ? "#a78bfa" : "#7c3aed") : (isDarkMode ? "#c8cce0" : "#4a4060"),
                    fontWeight: selected ? 800 : 600, fontSize: 14,
                    cursor: "pointer", transition: "all 0.15s",
                    fontFamily: "'Nunito', sans-serif",
                    display: "flex", alignItems: "center", gap: 12,
                    boxShadow: selected ? "0 2px 12px #7c3aed30" : "none",
                  }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: 13,
                    background: selected ? "#7c3aed" : (isDarkMode ? "#2a2d40" : "#f3f0ff"),
                    color: selected ? "#fff" : (isDarkMode ? "#a78bfa" : "#7c3aed"),
                  }}>
                    {String.fromCharCode(65 + oi)}
                  </span>
                  {opt.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        background: isDarkMode ? "#1a1d2e" : "#fff",
        borderTop: `2px solid ${isDarkMode ? "#2a2d40" : "#e9d5ff"}`,
        padding: "14px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button onClick={() => setCurrent(c => Math.max(c - 1, 0))} disabled={current === 0}
          style={{
            padding: "10px 20px", borderRadius: 12, border: `2px solid ${isDarkMode ? "#2a2d40" : "#e9d5ff"}`,
            background: "transparent", color: isDarkMode ? "#6b7090" : "#9b8ab0",
            fontWeight: 700, fontSize: 14, cursor: current === 0 ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6, opacity: current === 0 ? 0.4 : 1,
            fontFamily: "'Nunito', sans-serif",
          }}>
          <ArrowLeft size={16} /> Prev
        </button>

        <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? "#6b7090" : "#9b8ab0" }}>
          {answered}/{total} answered
        </div>

        {current < total - 1 ? (
          <button onClick={() => setCurrent(c => Math.min(c + 1, total - 1))}
            style={{
              padding: "10px 20px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff",
              fontWeight: 800, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "'Nunito', sans-serif",
            }}>
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={() => submit(answers)} disabled={submitting}
            style={{
              padding: "10px 24px", borderRadius: 12, border: "none",
              background: allAnswered
                ? "linear-gradient(135deg,#10b981,#059669)"
                : "linear-gradient(135deg,#f59e0b,#d97706)",
              color: "#fff", fontWeight: 800, fontSize: 14,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6, opacity: submitting ? 0.7 : 1,
              fontFamily: "'Nunito', sans-serif",
            }}>
            <Send size={15} /> {submitting ? "Submitting…" : allAnswered ? "Submit Quiz 🚀" : `Submit (${total - answered} unanswered)`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Result screen shown inline after completion ───────────────────────────────
function ResultScreen({ quiz, attempt, col, onDone }) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor = attempt.percentage >= 80 ? "#10b981" : attempt.percentage >= 60 ? "#f59e0b" : "#ef4444";
  const trophy     = attempt.percentage >= 90 ? "🏆" : attempt.percentage >= 75 ? "🥇" : attempt.percentage >= 60 ? "🥈" : "🥉";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Score card */}
      <div style={{
        background: attempt.percentage >= 80 ? "#f0fdf4" : attempt.percentage >= 60 ? "#fffbeb" : "#fef2f2",
        borderRadius: 20, padding: "28px 24px", textAlign: "center",
        border: `2.5px solid ${attempt.percentage >= 80 ? "#86efac" : attempt.percentage >= 60 ? "#fde68a" : "#fca5a5"}`,
      }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>{trophy}</div>
        <div style={{ fontWeight: 900, fontSize: 48, color: scoreColor }}>{attempt.percentage}%</div>
        <div style={{ fontWeight: 700, fontSize: 18, color: col.heading, marginBottom: 4 }}>
          {attempt.score} out of {attempt.totalQuestions} correct
        </div>
        <div style={{ fontSize: 13, color: col.muted }}>
          {attempt.timeTaken != null && `Completed in ${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s · `}
          {formatDate(attempt.submittedAt)}
        </div>
        {attempt.percentage >= 80 && (
          <div style={{ marginTop: 12, fontWeight: 700, fontSize: 15, color: "#059669" }}>
            Amazing work! Keep it up! 🌟
          </div>
        )}
      </div>

      {/* Review toggle */}
      <button onClick={() => setExpanded(v => !v)}
        style={{
          padding: "12px 20px", borderRadius: 14, border: `2px solid ${col.border}`,
          background: col.card, color: col.heading, fontWeight: 700, fontSize: 14,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "'Nunito', sans-serif",
        }}>
        <span>📋 Review Answers</span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {quiz.questions.map((q, i) => {
            const studentAns = attempt.answers[i];
            const correct    = studentAns === q.correctIndex;
            return (
              <div key={i} style={{
                background: correct ? (col.heading === "#f0f4ff" ? "#1e3a2f" : "#f0fdf4") : (col.heading === "#f0f4ff" ? "#3a1e1e" : "#fef2f2"),
                border: `2px solid ${correct ? "#86efac" : "#fca5a5"}`,
                borderRadius: 14, padding: "14px 16px",
              }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: col.heading, marginBottom: 10, display: "flex", gap: 8 }}>
                  <span style={{ background: correct ? "#10b981" : "#ef4444", color: "#fff", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>
                    {correct ? "✓" : "✗"}
                  </span>
                  Q{i + 1}: {q.question}
                </div>
                {q.options.map((opt, oi) => {
                  const isCorrect  = oi === q.correctIndex;
                  const isSelected = oi === studentAns;
                  const isWrong    = isSelected && !correct;
                  return (
                    <div key={oi} style={{
                      padding: "6px 12px", borderRadius: 8, marginBottom: 4, fontSize: 13,
                      fontWeight: isCorrect || isSelected ? 700 : 400,
                      background: isCorrect ? "#dcfce7" : isWrong ? "#fee2e2" : "transparent",
                      color: isCorrect ? "#166534" : isWrong ? "#991b1b" : col.body,
                    }}>
                      {String.fromCharCode(65 + oi)}. {opt.text}
                      {isCorrect && " ✓ Correct"}
                      {isWrong   && " ← Your answer"}
                      {isSelected && studentAns === -1 && " (skipped)"}
                    </div>
                  );
                })}
                {q.explanation && (
                  <div style={{ marginTop: 8, fontSize: 12, color: col.muted, fontStyle: "italic", paddingLeft: 8 }}>
                    💡 {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={onDone}
        style={{
          padding: "12px", borderRadius: 14, border: "none",
          background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff",
          fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
        }}>
        Back to Quiz List
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StudentQuizTab({ studentInfo, isDarkMode }) {
  const col = isDarkMode
    ? { bg: "#0f1117", card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#6b7090" }
    : { bg: "#fff8f0", card: "#ffffff", border: "#ffe8cc", heading: "#2d1f6e", body: "#4a4060", muted: "#9b8ab0" };

  const [quizzes,      setQuizzes]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState("all");
  const [expandedId,   setExpandedId]   = useState(null);
  const [activeQuiz,   setActiveQuiz]   = useState(null);   // quiz being taken right now
  const [resultData,   setResultData]   = useState(null);   // { quiz, attempt } after submission
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/quiz/assigned");
      setQuizzes(data.quizzes || []);
    } catch {
      showToast("Failed to load quizzes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuizzes(); }, []);

  const counts = {
    all:       quizzes.length,
    assigned:  quizzes.filter(q => q.status === "assigned").length,
    attempted: quizzes.filter(q => q.status === "attempted").length,
  };

  const filtered = quizzes.filter(q => filter === "all" || q.status === filter);

  const handleStartQuiz = (quiz) => {
    if (quiz.status === "attempted") return;
    if (!window.confirm(`You are about to start "${quiz.title}".\n\nTime limit: ${quiz.timeLimit} minutes.\nYou have ONE attempt only.\n\nReady?`)) return;
    setActiveQuiz(quiz);
  };

  const handleQuizComplete = (fullQuiz, attempt) => {
    setActiveQuiz(null);
    setResultData({ quiz: fullQuiz, attempt });
    fetchQuizzes();
  };

  // ── Active quiz full-screen mode ───────────────────────────────────────────
  if (activeQuiz) {
    return <QuizScreen quiz={activeQuiz} onComplete={handleQuizComplete} isDarkMode={isDarkMode} />;
  }

  // ── Just finished — show result ────────────────────────────────────────────
  if (resultData) {
    return (
      <div style={{ fontFamily: "'Nunito', sans-serif" }}>
        <ResultScreen
          quiz={resultData.quiz}
          attempt={resultData.attempt}
          col={col}
          onDone={() => setResultData(null)}
        />
      </div>
    );
  }

  // ── Quiz list ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "'Nunito', sans-serif" }}>

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: col.heading }}>📝 My Quizzes</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: col.muted }}>Take your tests and see your results!</p>
        </div>
        <button onClick={fetchQuizzes}
          style={{ padding: "8px 16px", borderRadius: 12, border: `2px solid ${col.border}`, background: col.card, color: col.body, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { key: "all",       label: "All Quizzes",    emoji: "📝", color: "#7c3aed", bg: "#f5f3ff" },
          { key: "assigned",  label: "To Attempt",     emoji: "⏳", color: "#d97706", bg: "#fffbeb" },
          { key: "attempted", label: "Completed",      emoji: "🏆", color: "#059669", bg: "#ecfdf5" },
        ].map(({ key, label, emoji, color, bg }) => (
          <div key={key} onClick={() => setFilter(key)}
            style={{ background: filter === key ? bg : col.card, border: `2.5px solid ${filter === key ? color : col.border}`, borderRadius: 16, padding: "14px 16px", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{emoji}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color }}>{counts[key]}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: col.muted, textTransform: "uppercase" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6 }}>
        {["all", "assigned", "attempted"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "6px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", background: filter === f ? "#7c3aed" : col.card, color: filter === f ? "#fff" : col.body, boxShadow: filter === f ? "0 2px 10px #7c3aed50" : "none" }}>
            {f === "all" ? "📝 All" : f === "assigned" ? "⏳ To Attempt" : "🏆 Completed"}
            {filter !== f && ` (${counts[f]})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: col.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <p style={{ fontWeight: 700 }}>Loading quizzes…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: col.card, borderRadius: 20, border: `2.5px dashed ${col.border}` }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{filter === "attempted" ? "🏆" : "🎉"}</div>
          <p style={{ fontWeight: 700, fontSize: 16, color: col.heading, margin: "0 0 4px" }}>
            {filter === "all" ? "No quizzes assigned yet!" : filter === "assigned" ? "No pending quizzes — you're all caught up!" : "No completed quizzes yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(quiz => {
            const isExpanded = expandedId === quiz._id;
            const days       = daysUntil(quiz.dueDate);
            const overdue    = days < 0 && quiz.status === "assigned";
            const teacher    = quiz.teacherId;

            return (
              <div key={quiz._id} style={{
                background: col.card,
                border: `2.5px solid ${isExpanded ? "#7c3aed" : col.border}`,
                borderRadius: 18, overflow: "hidden",
                boxShadow: isExpanded ? "0 4px 20px #7c3aed20" : "none",
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                      background: quiz.status === "attempted"
                        ? "linear-gradient(135deg,#10b981,#059669)"
                        : "linear-gradient(135deg,#7c3aed,#a855f7)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                    }}>
                      {quiz.status === "attempted" ? "🏆" : "📝"}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: col.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {quiz.title}
                      </div>
                      <div style={{ fontSize: 12, color: col.muted, marginTop: 3, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <span>👩‍🏫 {teacher?.firstName} {teacher?.lastName}</span>
                        <span>· {quiz.questions.length} questions</span>
                        <span>· ⏱ {quiz.timeLimit} min</span>
                        <span style={{ color: overdue ? "#ef4444" : col.muted }}>· Due {formatDate(quiz.dueDate)}</span>
                        {quiz.status === "assigned" && (
                          <span style={{
                            padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: overdue ? "#fee2e2" : days <= 2 ? "#fef3c7" : "#f0fdf4",
                            color: overdue ? "#dc2626" : days <= 2 ? "#d97706" : "#059669",
                          }}>
                            {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today!" : `${days}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {quiz.attempt && (
                      <span style={{ fontWeight: 900, fontSize: 16, color: quiz.attempt.percentage >= 80 ? "#10b981" : quiz.attempt.percentage >= 60 ? "#f59e0b" : "#ef4444" }}>
                        {quiz.attempt.percentage}%
                      </span>
                    )}
                    {quiz.status === "assigned" ? (
                      <button onClick={() => handleStartQuiz(quiz)}
                        style={{
                          padding: "8px 20px", borderRadius: 12, border: "none",
                          background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff",
                          fontWeight: 800, fontSize: 13, cursor: "pointer",
                          boxShadow: "0 2px 10px #7c3aed40", fontFamily: "'Nunito', sans-serif",
                        }}>
                        Start Quiz 🚀
                      </button>
                    ) : (
                      <button onClick={() => setExpandedId(isExpanded ? null : quiz._id)}
                        style={{ padding: "8px 16px", borderRadius: 12, border: `2px solid ${col.border}`, background: col.card, color: col.body, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        {isExpanded ? "Hide" : "Review"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Instructions panel for assigned quizzes */}
                {quiz.status === "assigned" && quiz.instructions && (
                  <div style={{ borderTop: `2px solid ${col.border}`, padding: "14px 20px", background: isDarkMode ? "#1f2235" : "#faf5ff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        📋 Instructions
                      </div>
                      <ListenButton text={quiz.instructions} />
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: col.body, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {quiz.instructions}
                    </p>
                  </div>
                )}

                {/* Expanded review (attempted only) */}
                {isExpanded && quiz.status === "attempted" && quiz.attempt && (
                  <div style={{ borderTop: `2px solid ${col.border}`, padding: 20 }}>
                    <ResultScreen
                      quiz={quiz}
                      attempt={quiz.attempt}
                      col={col}
                      onDone={() => setExpandedId(null)}
                    />
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
