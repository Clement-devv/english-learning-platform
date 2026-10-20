import { useState, useEffect, useRef, useCallback } from "react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import {
  Clock, CheckCircle2, RefreshCw, BookOpen,
  AlertTriangle, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Send,
} from "lucide-react";
import ListenButton from "../../../components/ListenButton";
import StreakToast from "../components/StreakToast";
import Pagination from "../../../components/Pagination";
import { useTranslation } from "react-i18next";
import { dateLocale } from "../../../i18n/dateLocale.js";

const LS_KEY = (quizId) => `quiz_start_${quizId}`;

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(dateLocale("en-GB"), { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(d) {
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
}

// ── Countdown display ─────────────────────────────────────────────────────────
function Countdown({ secondsLeft, totalSeconds }) {
  const { t: tr } = useTranslation("student");
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
        {critical ? tr("quizTab.hurry") : "REMAINING"}
      </div>
    </div>
  );
}

// ── Active quiz screen ────────────────────────────────────────────────────────
function QuizScreen({ quiz, onComplete, isDarkMode }) {
  const { t: tr } = useTranslation("student");

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
      const { data } = await api.post(`/quiz/${quiz._id}/attempt`, {
        answers:   finalAnswers,
        startedAt: startedAt.toISOString(),
        timeTaken,
      });
      localStorage.removeItem(LS_KEY(quiz._id));
      onComplete(data.quiz, data.attempt, data.streak);
    } catch (err) {
      alert(err?.response?.data?.message || tr("quizTab.submissionFailedPleaseTryAgain"));
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [totalSeconds, secondsLeft, quiz._id, startedAt, onComplete, tr]);

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
      background: isDarkMode ? "var(--as-bg, #0f1117)" : "#f3f0ff",
      display: "flex", flexDirection: "column",
      fontFamily: "'Nunito', sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        background: isDarkMode ? "var(--as-raised, #1a1d2e)" : "var(--as-surface, #fff)",
        borderBottom: `2px solid ${isDarkMode ? "var(--as-line, #2a2d40)" : "var(--as-accent-line, #e9d5ff)"}`,
        padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: isDarkMode ? "var(--as-ink, #f0f4ff)" : "#2d1f6e" }}>
            📝 {quiz.title}
          </div>
          <div style={{ fontSize: 12, color: isDarkMode ? "var(--as-ink-2, #6b7090)" : "#9b8ab0", marginTop: 2 }}>{tr("quizTab.questionOfAnswered", { value: current + 1, total, answered })}</div>
        </div>

        {/* Timer */}
        <Countdown secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: isDarkMode ? "var(--as-raised, #2a2d40)" : "var(--as-accent-line, #e9d5ff)" }}>
        <div style={{
          height: "100%", width: `${((current + 1) / total) * 100}%`,
          background: "linear-gradient(90deg,var(--as-accent, #7c3aed),var(--as-accent, #a855f7))", transition: "width 0.3s",
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
                ? "linear-gradient(135deg,var(--as-accent, #7c3aed),var(--as-accent, #a855f7))"
                : answers[i] !== -1
                  ? (isDarkMode ? "#1e3a2f" : "#dcfce7")
                  : (isDarkMode ? "var(--as-raised, #2a2d40)" : "#f3f0ff"),
              color: i === current ? "#fff" : answers[i] !== -1 ? "#166534" : isDarkMode ? "var(--as-ink-2, #6b7090)" : "var(--as-accent-ink, #7c3aed)",
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
          background: isDarkMode ? "var(--as-raised, #1a1d2e)" : "var(--as-surface, #fff)",
          borderRadius: 20, padding: "24px 28px",
          border: `2px solid ${isDarkMode ? "var(--as-line, #2a2d40)" : "var(--as-accent-line, #e9d5ff)"}`,
          boxShadow: "0 4px 24px color-mix(in srgb, var(--as-accent, #7c3aed) 10%, transparent)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: isDarkMode ? "var(--as-ink, #f0f4ff)" : "#2d1f6e", lineHeight: 1.5, flex: 1 }}>
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
                    border: `2.5px solid ${selected ? "var(--as-accent, #7c3aed)" : isDarkMode ? "var(--as-line, #2a2d40)" : "var(--as-accent-line, #e9d5ff)"}`,
                    background: selected
                      ? (isDarkMode ? "#2d1f4a" : "var(--as-accent-soft, #f5f0ff)")
                      : (isDarkMode ? "var(--as-raised, #1f2235)" : "var(--as-raised, #fafafa)"),
                    color: selected ? (isDarkMode ? "var(--as-accent-ink, #a78bfa)" : "var(--as-accent-ink, #7c3aed)") : (isDarkMode ? "var(--as-ink-2, #c8cce0)" : "#4a4060"),
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
                    background: selected ? "var(--as-accent, #7c3aed)" : (isDarkMode ? "var(--as-raised, #2a2d40)" : "#f3f0ff"),
                    color: selected ? "#fff" : (isDarkMode ? "var(--as-accent-ink, #a78bfa)" : "var(--as-accent-ink, #7c3aed)"),
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
        background: isDarkMode ? "var(--as-raised, #1a1d2e)" : "var(--as-surface, #fff)",
        borderTop: `2px solid ${isDarkMode ? "var(--as-line, #2a2d40)" : "var(--as-accent-line, #e9d5ff)"}`,
        padding: "14px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button onClick={() => setCurrent(c => Math.max(c - 1, 0))} disabled={current === 0}
          style={{
            padding: "10px 20px", borderRadius: 12, border: `2px solid ${isDarkMode ? "var(--as-line, #2a2d40)" : "var(--as-accent-line, #e9d5ff)"}`,
            background: "transparent", color: isDarkMode ? "var(--as-ink-2, #6b7090)" : "#9b8ab0",
            fontWeight: 700, fontSize: 14, cursor: current === 0 ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6, opacity: current === 0 ? 0.4 : 1,
            fontFamily: "'Nunito', sans-serif",
          }}>
          <ArrowLeft size={16} /> {tr("quizTab.prev")}
        </button>

        <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? "var(--as-ink-2, #6b7090)" : "#9b8ab0" }}>
          {tr("quizTab.answered", { answered, total })}</div>

        {current < total - 1 ? (
          <button onClick={() => setCurrent(c => Math.min(c + 1, total - 1))}
            style={{
              padding: "10px 20px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,var(--as-accent, #7c3aed),var(--as-accent, #a855f7))", color: "#fff",
              fontWeight: 800, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "'Nunito', sans-serif",
            }}>
            {tr("quizTab.next")} <ArrowRight size={16} />
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
            <Send size={15} /> {submitting ? tr("quizTab.submitting") : allAnswered ? tr("quizTab.submitQuiz") : tr("quizTab.submitUnanswered", { value: total - answered })}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Result screen shown inline after completion ───────────────────────────────
function ResultScreen({ quiz, attempt, col, onDone }) {
  const { t: tr } = useTranslation("student");
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
          {tr("quizTab.outOfCorrect", { score: attempt.score, totalQuestions: attempt.totalQuestions })}</div>
        <div style={{ fontSize: 13, color: col.muted }}>
          {attempt.timeTaken != null && tr("quizTab.completedInMS", { value: Math.floor(attempt.timeTaken / 60), value2: attempt.timeTaken % 60 })}
          {formatDate(attempt.submittedAt)}
        </div>
        {attempt.percentage >= 80 && (
          <div style={{ marginTop: 12, fontWeight: 700, fontSize: 15, color: "#059669" }}>
            {tr("quizTab.amazingWorkKeepItUp")}
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
        <span>{tr("quizTab.reviewAnswers")}</span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {quiz.questions.map((q, i) => {
            const studentAns = attempt.answers[i];
            const correct    = studentAns === q.correctIndex;
            return (
              <div key={i} style={{
                background: correct ? (col.heading === "var(--as-raised, #f0f4ff)" ? "#1e3a2f" : "#f0fdf4") : (col.heading === "var(--as-raised, #f0f4ff)" ? "#3a1e1e" : "#fef2f2"),
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
                      {isCorrect && tr("quizTab.correct")}
                      {isWrong   && tr("quizTab.yourAnswer")}
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
          background: "linear-gradient(135deg,var(--as-accent, #7c3aed),var(--as-accent, #a855f7))", color: "#fff",
          fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
        }}>
        {tr("quizTab.backToQuizList")}
      </button>
    </div>
  );
}

// ── Start-quiz confirmation modal ─────────────────────────────────────────────
function StartQuizModal({ quiz, onConfirm, onCancel, isDarkMode }) {
  const { t: tr } = useTranslation("student");
  const col = isDarkMode
    ? { bg: "var(--as-raised, #1a1d2e)", border: "var(--as-line, #2a2d40)", heading: "var(--as-ink, #f0f4ff)", body: "var(--as-ink-2, #c8cce0)", muted: "var(--as-ink-2, #6b7090)" }
    : { bg: "var(--as-surface, #ffffff)", border: "var(--as-accent-line, #e9d5ff)", heading: "#2d1f6e", body: "#4a4060", muted: "#9b8ab0" };

  if (!quiz) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.55)", padding: 20,
    }}>
      <div style={{
        background: col.bg, borderRadius: 24, padding: "32px 28px",
        maxWidth: 440, width: "100%",
        border: `2px solid ${col.border}`,
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        fontFamily: "'Nunito', sans-serif",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>📝</div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: col.heading }}>
            {tr("quizTab.startQuiz")}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: col.muted, fontWeight: 600 }}>
            {tr("quizTab.areYouReadyToBegin")}
          </p>
        </div>

        {/* Quiz info */}
        <div style={{
          background: isDarkMode ? "var(--as-raised, #1f2235)" : "var(--as-accent-soft, #f5f0ff)",
          borderRadius: 16, padding: "16px 18px", marginBottom: 20,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: col.heading }}>{quiz.title}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, color: col.body, fontWeight: 600 }}>
            <span>{tr("quizTab.questions", { value: quiz.questions?.length || "—" })}</span>
            <span>{tr("quizTab.min", { timeLimit: quiz.timeLimit })}</span>
            <span>👩‍🏫 {quiz.teacherId?.firstName} {quiz.teacherId?.lastName}</span>
          </div>
        </div>

        {/* Warning */}
        <div style={{
          background: isDarkMode ? "rgba(245,158,11,0.1)" : "#fffbeb",
          border: `1.5px solid ${isDarkMode ? "rgba(245,158,11,0.3)" : "#fde68a"}`,
          borderRadius: 12, padding: "10px 14px", marginBottom: 24,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 12.5, color: isDarkMode ? "#fcd34d" : "#92400e", fontWeight: 700, lineHeight: 1.5 }}>
            {tr("quizTab.youOnlyGet")} <strong>{tr("quizTab.oneAttempt")}</strong>{tr("quizTab.theTimerStartsImmediatelyOnce")}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel}
            style={{
              flex: 1, padding: "12px", borderRadius: 14,
              border: `2px solid ${col.border}`, background: "transparent",
              color: col.body, fontWeight: 700, fontSize: 14,
              cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            }}>
            {tr("quizTab.notYet")}
          </button>
          <button onClick={onConfirm}
            style={{
              flex: 2, padding: "12px", borderRadius: 14, border: "none",
              background: "linear-gradient(135deg,var(--as-accent, #7c3aed),var(--as-accent, #a855f7))", color: "#fff",
              fontWeight: 900, fontSize: 14, cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {tr("quizTab.yesStartNow")} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StudentQuizTab({ isDarkMode }) {
  const { t: tr } = useTranslation("student");
  const col = isDarkMode
    ? { bg: "var(--as-bg, #0f1117)", card: "var(--as-raised, #1a1d2e)", border: "var(--as-line, #2a2d40)", heading: "var(--as-ink, #f0f4ff)", body: "var(--as-ink-2, #c8cce0)", muted: "var(--as-ink-2, #6b7090)" }
    : { bg: "var(--as-raised, #fff8f0)", card: "var(--as-surface, #ffffff)", border: "var(--as-line, #ffe8cc)", heading: "var(--as-ink, #3d2e20)", body: "var(--as-ink-2, #5a4a3a)", muted: "var(--as-muted, #a89480)" };
  const accent = isDarkMode ? "var(--as-accent-ink, #fb923c)" : "var(--as-accent-ink, #f97316)";

  const [quizzes,      setQuizzes]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState("all");
  const [expandedId,   setExpandedId]   = useState(null);
  const [activeQuiz,   setActiveQuiz]   = useState(null);   // quiz being taken right now
  const [pendingQuiz,  setPendingQuiz]  = useState(null);   // quiz awaiting confirmation modal
  const [resultData,   setResultData]   = useState(null);   // { quiz, attempt } after submission
  const [toast,        setToast]        = useState(null);
  const [streakToast,  setStreakToast]  = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Paged on the server (20 per page) — counts per status come back with every page
  const [page,      setPage]      = useState(1);
  const [pager,     setPager]     = useState({ total: 0, totalPages: 1, limit: 20 });
  const [counts,    setCounts]    = useState({ all: 0, assigned: 0, attempted: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const [stats,     setStats]     = useState({ nextQuiz: null, avgScore: null }); // across all pages
  const changeFilter = (f) => { setFilter(f); setPage(1); };
  const fetchQuizzes = () => setReloadKey(k => k + 1);
  // Live: teacher assigns / grades → refresh quietly (no spinner)
  const quietRef = useRef(false);
  useOnDataChanged(["quizzes"], () => { quietRef.current = true; fetchQuizzes(); });

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        if (!quietRef.current) setLoading(true);
        quietRef.current = false;
        const { data } = await api.get("/quiz/assigned", { params: { status: filter === "all" ? undefined : filter, page } });
        if (stale) return;
        setQuizzes(data.quizzes || []);
        if (data.counts) setCounts(data.counts);
        if (data.stats) setStats(data.stats);
        if (data.pagination) { setPager(data.pagination); if (data.pagination.page !== page) setPage(data.pagination.page); }
      } catch {
        if (!stale) showToast(tr("quizTab.failedToLoadQuizzes"), "error");
      } finally {
        if (!stale) setLoading(false);
      }
    })();
    return () => { stale = true; };
  }, [page, filter, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps


  const filtered = quizzes; // already filtered + paged by the server

  const handleStartQuiz = (quiz) => {
    if (quiz.status === "attempted") return;
    if (quiz.dueDate && daysUntil(quiz.dueDate) < 0) return; // overdue — blocked
    setPendingQuiz(quiz);
  };

  const handleConfirmStart = () => {
    if (!pendingQuiz) return;
    setActiveQuiz(pendingQuiz);
    setPendingQuiz(null);
  };

  const handleQuizComplete = (fullQuiz, attempt, streak) => {
    setActiveQuiz(null);
    setResultData({ quiz: fullQuiz, attempt });
    fetchQuizzes();
    if (streak?.incremented) setStreakToast(streak);
  };

  // ── Active quiz full-screen mode ───────────────────────────────────────────
  if (activeQuiz) {
    return <QuizScreen quiz={activeQuiz} onComplete={handleQuizComplete} isDarkMode={isDarkMode} />;
  }

  // ── Confirmation modal (rendered above quiz list) ──────────────────────────
  const confirmModal = (
    <StartQuizModal
      quiz={pendingQuiz}
      onConfirm={handleConfirmStart}
      onCancel={() => setPendingQuiz(null)}
      isDarkMode={isDarkMode}
    />
  );

  // ── Just finished — show result ────────────────────────────────────────────
  if (resultData) {
    return (
      <div style={{ fontFamily: "'Nunito', sans-serif" }}>
        <StreakToast data={streakToast} onDone={() => setStreakToast(null)} />
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
  const { nextQuiz, avgScore } = stats;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "'Nunito', sans-serif" }}>

      {confirmModal}
      <StreakToast data={streakToast} onDone={() => setStreakToast(null)} />

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
      <div className="qz-head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="qz-title" style={{ fontSize: 11.5, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>{tr("quizTab.learning")}</div>
          <h1 className="qz-title" style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 900, color: col.heading, letterSpacing: "-0.4px" }}>{tr("quizTab.quizzes")}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: col.muted, fontWeight: 600 }}>
            {counts.assigned > 0 ? tr("quizTab.readyToTake", { assigned: counts.assigned }) : tr("quizTab.allQuizzesDone")}{avgScore != null ? tr("quizTab.avgScore", { avgScore }) : ""}
          </p>
        </div>
        <button onClick={fetchQuizzes}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, border: `2px solid ${col.border}`, background: col.card, color: col.body, cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "inherit" }}>
          <RefreshCw size={14} /> {tr("quizTab.refresh")}
        </button>
      </div>

      {/* Featured next-up banner */}
      {!loading && nextQuiz && (() => {
        const bannerOverdue = nextQuiz.dueDate && daysUntil(nextQuiz.dueDate) < 0;
        return (
          <div style={{ background: "linear-gradient(135deg,var(--as-accent, #f97316),#f43f5e)", borderRadius: 24, padding: "22px 26px", color: "#fff", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 16px 40px rgba(249,115,22,0.28)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -20, top: -30, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }}/>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
              <BookOpen size={28} stroke="#fff" strokeWidth={2.2}/>
            </div>
            <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.1em", opacity: 0.9 }}>
                {bannerOverdue ? "OVERDUE" : tr("quizTab.nextUp")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>{nextQuiz.title}</div>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.95, marginTop: 2 }}>
                {tr("quizTab.questionsMin", { value: nextQuiz.questions?.length || "—", timeLimit: nextQuiz.timeLimit, firstName: nextQuiz.teacherId?.firstName, lastName: nextQuiz.teacherId?.lastName })}
              </div>
            </div>
            {bannerOverdue ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 22px", borderRadius: 999, background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                {tr("quizTab.overdue")}
              </div>
            ) : (
              <button onClick={() => handleStartQuiz(nextQuiz)}
                style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 22px", borderRadius: 999, border: "none", background: "var(--as-surface, #fff)", color: "#c2410c", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(0,0,0,0.15)", flexShrink: 0 }}>
                {tr("quizTab.startQuiz2")} <ArrowRight size={14} stroke="#c2410c"/>
              </button>
            )}
          </div>
        );
      })()}

      {/* Phone layout: stats as a 2×2 grid, filter row full width — nothing wider than the screen */}
      <style>{`
        @media (max-width: 640px) {
          .qz-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
          .qz-stats > div { padding: 12px !important; gap: 10px !important; }
          .qz-stats > div > div:first-child { width: 34px !important; height: 34px !important; font-size: 17px !important; }
          .qz-filters { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)); align-self: stretch !important; }
          .qz-filters button { justify-content: center; padding: 8px 4px !important; min-width: 0; }
          .qz-title { display: none; }                                   /* top bar already says "Quizzes" */
          .qz-head { align-items: center !important; flex-wrap: nowrap !important; }
          .qz-head p { margin: 0 !important; font-size: 13px !important; }
          .qz-card-head { flex-wrap: wrap; gap: 12px; padding: 14px !important; }
          .qz-card-main { flex-basis: 100% !important; align-items: flex-start !important; gap: 12px !important; }
          .qz-card-main > div:first-child { width: 42px !important; height: 42px !important; font-size: 19px !important; }
          .qz-card-title { white-space: normal !important; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; }
          .qz-card-actions { width: 100%; justify-content: flex-end; }
          .qz-card-actions > button:last-child, .qz-card-actions > button:only-child { flex: 1; }
        }
      `}</style>

      {/* Stats strip */}
      <div className="qz-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
        {[
          { key: "all",       label: tr("quizTab.total"),        emoji: "📝", color: "var(--as-accent-ink, #f97316)", bg: "var(--as-accent-soft, #fff7ed)" },
          { key: "assigned",  label: tr("quizTab.readyToTake2"), emoji: "⏳", color: "#a16207", bg: "#fef3c7" },
          { key: "attempted", label: tr("quizTab.completed"),    emoji: "🏆", color: "#059669", bg: "#ecfdf5" },
          { key: "_avg",      label: tr("quizTab.avgScore2"),    emoji: "⭐", color: "#be185d", bg: "#fce7f3" },
        ].map(({ key, label, emoji, color, bg }) => (
          <div key={key} onClick={() => key !== "_avg" && changeFilter(key)}
            style={{ background: col.card, border: `2px solid ${filter === key ? color : col.border}`, borderRadius: 18, padding: "14px 16px", cursor: key !== "_avg" ? "pointer" : "default", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s", boxShadow: filter === key ? `0 4px 16px color-mix(in srgb, ${color} 15%, transparent)` : "none" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: filter === key ? bg : (isDarkMode ? "rgba(255,255,255,0.05)" : "#f9f9f9"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: "-0.3px", lineHeight: 1.1 }}>
                {key === "_avg" ? (avgScore != null ? `${avgScore}%` : "—") : counts[key]}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: col.muted }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="qz-filters" style={{ display: "flex", gap: 6, background: col.card, border: `2px solid ${col.border}`, borderRadius: 14, padding: 4, alignSelf: "flex-start" }}>
        {[
          { k: "all",       l: "All"       },
          { k: "assigned",  l: "To take"   },
          { k: "attempted", l: "Completed" },
        ].map(f => {
          const isActive = filter === f.k;
          return (
            <button key={f.k} onClick={() => changeFilter(f.k)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, background: isActive ? `linear-gradient(135deg,${accent},var(--as-accent, #fb923c))` : "transparent", color: isActive ? "#fff" : col.body, boxShadow: isActive ? `0 4px 12px color-mix(in srgb, ${accent} 33%, transparent)` : "none", transition: "all 0.15s" }}>
              {f.l}
              <span style={{ padding: "1px 7px", borderRadius: 999, fontSize: 10.5, fontWeight: 900, background: isActive ? "rgba(255,255,255,0.28)" : (isDarkMode ? "rgba(255,255,255,0.1)" : "#fff3e6"), color: isActive ? "#fff" : col.muted }}>{counts[f.k]}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: col.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <p style={{ fontWeight: 700 }}>{tr("quizTab.loadingQuizzes")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: col.card, borderRadius: 20, border: `2.5px dashed ${col.border}` }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{filter === "attempted" ? "🏆" : "🎉"}</div>
          <p style={{ fontWeight: 700, fontSize: 16, color: col.heading, margin: "0 0 4px" }}>
            {filter === "all" ? tr("quizTab.noQuizzesAssignedYet") : filter === "assigned" ? tr("quizTab.noPendingQuizzesYouRe") : tr("quizTab.noCompletedQuizzesYet")}
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
                border: `2.5px solid ${isExpanded ? "var(--as-accent, #7c3aed)" : col.border}`,
                borderRadius: 18, overflow: "hidden",
                boxShadow: isExpanded ? "0 4px 20px #7c3aed20" : "none",
              }}>
                {/* Header */}
                <div className="qz-card-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
                  <div className="qz-card-main" style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      background: quiz.status === "attempted"
                        ? "linear-gradient(135deg,#10b981,#059669)"
                        : "linear-gradient(135deg,var(--as-accent, #f97316),var(--as-accent, #fb923c))",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                    }}>
                      {quiz.status === "attempted" ? "🏆" : "📝"}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="qz-card-title" style={{ fontWeight: 800, fontSize: 15, color: col.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {quiz.title}
                      </div>
                      <div style={{ fontSize: 12, color: col.muted, marginTop: 3, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <span>👩‍🏫 {teacher?.firstName} {teacher?.lastName}</span>
                        <span>{tr("quizTab.questions2", { questionsCount: quiz.questions.length })}</span>
                        <span>{tr("quizTab.min2", { timeLimit: quiz.timeLimit })}</span>
                        <span style={{ color: overdue ? "#ef4444" : col.muted }}>{tr("quizTab.due", { formatDate: formatDate(quiz.dueDate) })}</span>
                        {quiz.status === "assigned" && (
                          <span style={{
                            padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: overdue ? "#fee2e2" : days <= 2 ? "#fef3c7" : "#f0fdf4",
                            color: overdue ? "#dc2626" : days <= 2 ? "#d97706" : "#059669",
                          }}>
                            {overdue ? tr("quizTab.expired") : days === 0 ? tr("quizTab.dueToday") : tr("quizTab.dLeft", { days })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="qz-card-actions" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {quiz.attempt && (
                      <span style={{ fontWeight: 900, fontSize: 16, color: quiz.attempt.percentage >= 80 ? "#10b981" : quiz.attempt.percentage >= 60 ? "#f59e0b" : "#ef4444" }}>
                        {quiz.attempt.percentage}%
                      </span>
                    )}
                    {quiz.status === "assigned" ? (
                      overdue ? (
                        <button disabled
                          title={tr("quizTab.thisQuizIsPastIts")}
                          style={{
                            padding: "8px 20px", borderRadius: 999, border: "none",
                            background: isDarkMode ? "var(--as-raised, #2a2d40)" : "var(--as-raised, #f3f4f6)",
                            color: isDarkMode ? "var(--as-ink-2, #6b7090)" : "var(--as-muted, #9ca3af)",
                            fontWeight: 700, fontSize: 13, cursor: "not-allowed",
                            fontFamily: "'Nunito', sans-serif",
                          }}>
                          {tr("quizTab.overdue")}
                        </button>
                      ) : (
                        <button onClick={() => handleStartQuiz(quiz)}
                          style={{
                            padding: "8px 20px", borderRadius: 999, border: "none",
                            background: "linear-gradient(135deg,var(--as-accent, #f97316),#f43f5e)", color: "#fff",
                            fontWeight: 900, fontSize: 13, cursor: "pointer",
                            boxShadow: "0 4px 14px rgba(249,115,22,0.4)", fontFamily: "'Nunito', sans-serif",
                          }}>
                          {tr("quizTab.startQuiz3")}
                        </button>
                      )
                    ) : (
                      <button onClick={() => setExpandedId(isExpanded ? null : quiz._id)}
                        style={{ padding: "8px 16px", borderRadius: 12, border: `2px solid ${col.border}`, background: col.card, color: col.body, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        {isExpanded ? tr("quizTab.hide") : tr("quizTab.review")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Instructions panel for assigned quizzes */}
                {quiz.status === "assigned" && quiz.instructions && (
                  <div style={{ borderTop: `2px solid ${col.border}`, padding: "14px 20px", background: isDarkMode ? "var(--as-raised, #1f2235)" : "var(--as-accent-soft, #faf5ff)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--as-accent-ink, #7c3aed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {tr("quizTab.instructions")}
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

      {!loading && (
        <Pagination page={page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit}
          onPage={(p) => { setPage(p); setExpandedId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} isDarkMode={isDarkMode} />
      )}
    </div>
  );
}
