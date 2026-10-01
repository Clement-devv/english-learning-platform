// src/pages/quiz-link/QuizLinkPage.jsx
// Public page for a quiz share link (managed students — no login).
// Flow: name check → mission briefing → timed quiz (one question at a time)
//       → results with review. Kid-friendly hero theme: src/components/hero/.
// The server owns the clock (start time is stamped once) and the scoring;
// correct answers are only sent after submitting.
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Clock, ListChecks, Timer, ChevronLeft, ChevronRight, Flag, Check, X as XIcon, Lightbulb, Rocket } from "lucide-react";
import api from "../../api";
import { HERO, HERO_FONTS, scoreStamp } from "../../components/hero/heroTheme";
import { StarBuddy, Celebration, PowBurst } from "../../components/hero/HeroScene";
import { HeroPage, HeroGate, HeroNotice, HeroLoading, useShareLinkSession } from "../../components/hero/HeroLinkKit";

const LETTERS = ["A", "B", "C", "D"];
const OPTION_COLORS = [HERO.red, HERO.blue, HERO.green, HERO.sunDeep];

const fmtDate  = (d) => new Date(d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fmtClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtDuration = (sec) => {
  if (sec == null) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
};

// Quiz-only styles (shared ones live in HeroLinkKit)
const PAGE_CSS = `
.ql-steps { list-style: none; margin: 0 0 26px; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.ql-steps li { display: flex; gap: 12px; align-items: flex-start; font-size: 16px; line-height: 1.5; }
.ql-step-n { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; border: 2.5px solid ${HERO.ink}; color: #fff; font: 700 14px ${HERO_FONTS.heading}; display: inline-flex; align-items: center; justify-content: center; }
.ql-bar { position: sticky; top: 10px; z-index: 5; display: flex; align-items: center; gap: 14px; padding: 12px 16px; }
.ql-timer { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 3px solid ${HERO.ink}; border-radius: 999px; background: ${HERO.sun}; font: 700 18px ${HERO_FONTS.heading}; min-width: 92px; justify-content: center; font-variant-numeric: tabular-nums; }
.ql-timer.low { background: ${HERO.red}; color: #fff; animation: ql-pulse 1s ease-in-out infinite; }
@keyframes ql-pulse { 50% { transform: scale(1.07); } }
.ql-progress { flex: 1; min-width: 0; }
.ql-track { height: 14px; border: 2.5px solid ${HERO.ink}; border-radius: 999px; background: #fff; overflow: hidden; }
.ql-fill { height: 100%; background: ${HERO.green}; transition: width .35s ease; }
.ql-q { font-family: ${HERO_FONTS.heading}; font-weight: 700; font-size: 24px; line-height: 1.35; margin: 6px 0 22px; }
.ql-opts { display: flex; flex-direction: column; gap: 12px; }
.ql-opt { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; padding: 14px 16px; border: 3px solid ${HERO.ink}; border-radius: 18px; background: #fff; box-shadow: 4px 4px 0 ${HERO.ink}; cursor: pointer; font: 600 17px ${HERO_FONTS.body}; color: ${HERO.ink}; transition: transform .08s, box-shadow .08s, background .15s; }
.ql-opt:hover { transform: translate(-1px,-1px); box-shadow: 5px 5px 0 ${HERO.ink}; }
.ql-opt:active { transform: translate(3px,3px); box-shadow: 1px 1px 0 ${HERO.ink}; }
.ql-opt:focus-visible { outline: 4px solid ${HERO.sun}; outline-offset: 3px; }
.ql-opt[aria-checked="true"] { background: #FFF6D1; box-shadow: 4px 4px 0 ${HERO.ink}, inset 0 0 0 3px ${HERO.sun}; }
.ql-letter { flex-shrink: 0; width: 38px; height: 38px; border-radius: 12px; border: 2.5px solid ${HERO.ink}; display: inline-flex; align-items: center; justify-content: center; font: 700 18px ${HERO_FONTS.heading}; color: #fff; }
.ql-dots { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.ql-dot { width: 34px; height: 34px; border-radius: 50%; border: 2.5px solid ${HERO.ink}; background: #fff; font: 700 14px ${HERO_FONTS.body}; color: ${HERO.ink}; cursor: pointer; }
.ql-dot.answered { background: ${HERO.green}; color: #fff; }
.ql-dot.current { box-shadow: 0 0 0 4px ${HERO.sun}; }
.ql-review { border: 2.5px solid ${HERO.ink}; border-radius: 18px; padding: 16px; background: #fff; }
.ql-ropt { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 12px; border: 2px solid #D5DBEF; font-size: 15px; margin-top: 8px; }
.ql-ropt.right { border-color: ${HERO.green}; background: ${HERO.greenPale}; font-weight: 700; }
.ql-ropt.wrong { border-color: ${HERO.red}; background: #FFE8E9; }
.ql-tag { margin-left: auto; font-size: 12px; font-weight: 700; white-space: nowrap; }
.ql-tip { display: flex; gap: 10px; margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: #FFF7D6; border: 2px solid ${HERO.sunDeep}; font-size: 14px; line-height: 1.5; }
.ql-mark { width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid ${HERO.ink}; display: inline-flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
@media (max-width: 420px) { .ql-q { font-size: 21px; } .ql-opt { font-size: 16px; padding: 12px 14px; } }
`;

export default function QuizLinkPage() {
  const { token } = useParams();
  const basePath = `/quiz/link/${token}`;
  const s = useShareLinkSession({ basePath, dataKey: "quiz", storageKey: `qzAccess:${token?.slice(0, 12)}` });

  return (
    <HeroPage extraCss={PAGE_CSS}>
      {s.phase === "loading" && <HeroLoading text="Loading your quiz…" />}
      {s.phase === "invalid" && (
        <HeroNotice title="Oops! This link doesn't work"
          text={s.message || "This quiz link is invalid or has been removed. Please ask your teacher for a new link."} />
      )}
      {s.phase === "expired" && (
        <HeroNotice title="This quiz has ended"
          text={s.message || "The due date for this quiz has passed. Ask your teacher if you still want to take it."} />
      )}
      {s.phase === "gate" && (
        <HeroGate unlockPath={`${basePath}/unlock`} subtitle="Your quiz mission is waiting." onUnlocked={s.onUnlocked} onFailure={s.onFailure} />
      )}
      {s.phase === "view" && s.data && (
        <QuizFlow token={token} basePath={basePath} quiz={s.data} setQuiz={s.setData} headers={s.headers} onFailure={s.onFailure} />
      )}
    </HeroPage>
  );
}

function QuizFlow({ token, basePath, quiz, setQuiz, headers, onFailure }) {
  const [celebrate, setCelebrate] = useState(false);
  if (quiz.status === "ready") return <Briefing basePath={basePath} quiz={quiz} setQuiz={setQuiz} headers={headers} onFailure={onFailure} />;
  if (quiz.status === "in_progress") {
    return (
      <Player token={token} basePath={basePath} quiz={quiz} headers={headers} onFailure={onFailure}
        onDone={(q) => { setQuiz(q); setCelebrate(true); setTimeout(() => setCelebrate(false), 4500); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
    );
  }
  return <Results quiz={quiz} celebrate={celebrate} />;
}

// ── 1. Mission briefing ───────────────────────────────────────────────────────
function Briefing({ basePath, quiz, setQuiz, headers, onFailure }) {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`${basePath}/start`, {}, { headers: headers() });
      setQuiz(data.quiz);
    } catch (err) {
      if (!onFailure(err)) setError(err?.response?.data?.message || "Could not start. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="hl-card" style={{ position: "relative", overflow: "hidden" }}>
        <div className="hl-anim" style={{ position: "absolute", right: 14, top: 14, animation: "hl-bounce 2.2s ease-in-out infinite" }}>
          <StarBuddy size={56} />
        </div>
        {quiz.centerName && (
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: HERO.inkSoft, paddingRight: 64 }}>
            {quiz.centerName}
          </p>
        )}
        <p style={{ margin: "0 0 6px", fontFamily: HERO_FONTS.heading, fontWeight: 700, fontSize: 18, color: HERO.redDeep, paddingRight: 64 }}>
          Hi {quiz.studentName}! 👋
        </p>
        <h1 className="hl-h1" style={{ paddingRight: 64 }}>{quiz.title}</h1>
        <p className="hl-muted" style={{ margin: "12px 0 18px", fontSize: 16 }}>
          A quiz mission from <strong style={{ color: HERO.ink }}>{quiz.teacherName}</strong>
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <span className="hl-chip"><ListChecks size={16} /> {quiz.questionCount} question{quiz.questionCount !== 1 ? "s" : ""}</span>
          <span className="hl-chip" style={{ background: "#fff" }}><Timer size={16} /> {quiz.timeLimit} minute{quiz.timeLimit !== 1 ? "s" : ""}</span>
          <span className="hl-chip" style={{ background: "#fff" }}><Clock size={16} /> Due {fmtDate(quiz.dueDate)}</span>
        </div>
      </section>

      <section className="hl-card" style={{ animationDelay: ".08s" }}>
        {quiz.instructions && (
          <>
            <h2 className="hl-h2"><span className="hl-ico" style={{ background: HERO.sun }}>📜</span> Your mission</h2>
            <p style={{ margin: "0 0 22px", fontSize: 17, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{quiz.instructions}</p>
          </>
        )}
        <h2 className="hl-h2"><span className="hl-ico" style={{ background: HERO.blue, color: "#fff" }}>⏱️</span> How it works</h2>
        <ol className="ql-steps">
          {[
            <>The timer starts when you press <strong>Start</strong>.</>,
            <>Pick one answer for each question. You can go back and change them.</>,
            <>When time runs out, your answers are sent automatically.</>,
            <>You can only take this quiz <strong>once</strong>.</>,
          ].map((text, i) => (
            <li key={i}><span className="ql-step-n" style={{ background: OPTION_COLORS[i] }}>{i + 1}</span><span>{text}</span></li>
          ))}
        </ol>
        {error && <p className="hl-error" role="alert">{error}</p>}
        <button type="button" className="hl-btn hl-btn-main" onClick={start} disabled={busy}>
          <Rocket size={20} /> {busy ? "Starting…" : "I'm ready! Start"}
        </button>
      </section>
    </>
  );
}

// ── 2. Timed player ───────────────────────────────────────────────────────────
function Player({ token, basePath, quiz, headers, onFailure, onDone }) {
  const total = quiz.questions.length;
  const saveKey = `qzAnswers:${token.slice(0, 12)}`;

  // Answers survive a refresh (the server keeps the clock running anyway)
  const [answers, setAnswers] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(saveKey) || "null");
      if (Array.isArray(saved) && saved.length === total) return saved;
    } catch { /* ignore */ }
    return Array(total).fill(-1);
  });
  const [index, setIndex]       = useState(() => Math.max(0, answers.findIndex(a => a < 0)));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [timeUp, setTimeUp]     = useState(false);

  // Server-synced countdown
  const offset = useRef(new Date(quiz.serverNow).getTime() - Date.now());
  const endsAt = new Date(quiz.endsAt).getTime();
  const [left, setLeft] = useState(() => endsAt - (Date.now() + offset.current));
  const submitted = useRef(false);

  useEffect(() => {
    try { sessionStorage.setItem(saveKey, JSON.stringify(answers)); } catch { /* ignore */ }
  }, [answers, saveKey]);

  const submit = useCallback(async (auto = false) => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true); setError(""); setConfirming(false);
    if (auto) setTimeUp(true);
    try {
      const { data } = await api.post(`${basePath}/submit`, { answers }, { headers: headers() });
      try { sessionStorage.removeItem(saveKey); } catch { /* ignore */ }
      onDone(data.quiz);
    } catch (err) {
      submitted.current = false;
      if (!onFailure(err)) setError(err?.response?.data?.message || "Could not send your answers. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [answers, basePath, headers, onDone, onFailure, saveKey]);

  // Latest submit for the timer (so the interval is set up once, not every render)
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    const t = setInterval(() => {
      const ms = endsAt - (Date.now() + offset.current);
      setLeft(ms);
      if (ms <= 0) { clearInterval(t); submitRef.current(true); }
    }, 500);
    return () => clearInterval(t);
  }, [endsAt]);

  const q = quiz.questions[index];
  const answeredCount = answers.filter(a => a >= 0).length;
  const skipped = total - answeredCount;
  const pick = (opt) => setAnswers(prev => prev.map((a, i) => (i === index ? opt : a)));
  const isLast = index === total - 1;

  return (
    <>
      {/* Timer + progress */}
      <div className="hl-card ql-bar" style={{ animation: "none" }}>
        <span className={`ql-timer${left <= 60_000 ? " low" : ""}`} role="timer" aria-live="off" aria-label={`Time left ${fmtClock(left)}`}>
          <Timer size={18} /> {fmtClock(left)}
        </span>
        <div className="ql-progress">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Question {index + 1} of {total}</div>
          <div className="ql-track"><div className="ql-fill" style={{ width: `${(answeredCount / total) * 100}%` }} /></div>
        </div>
      </div>

      {timeUp && (
        <div className="hl-card" style={{ textAlign: "center", background: HERO.sun }}>
          <p style={{ margin: 0, fontFamily: HERO_FONTS.heading, fontWeight: 700, fontSize: 20 }}>⏰ Time's up! Sending your answers…</p>
        </div>
      )}

      {/* Question */}
      <section className="hl-card" key={index}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: HERO.inkSoft, letterSpacing: ".06em" }}>QUESTION {index + 1}</p>
        <p className="ql-q" id="ql-question">{q.question}</p>
        <div className="ql-opts" role="radiogroup" aria-labelledby="ql-question">
          {q.options.map((o, i) => (
            <button key={i} type="button" role="radio" aria-checked={answers[index] === i} className="ql-opt"
              onClick={() => pick(i)} disabled={busy}>
              <span className="ql-letter" style={{ background: OPTION_COLORS[i] }}>{LETTERS[i]}</span>
              <span style={{ flex: 1 }}>{o.text}</span>
              {answers[index] === i && <Check size={22} strokeWidth={3} color={HERO.green} />}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
          <button type="button" className="hl-btn hl-btn-soft" style={{ flex: "1 1 110px" }}
            onClick={() => setIndex(i => i - 1)} disabled={index === 0 || busy}>
            <ChevronLeft size={18} /> Back
          </button>
          {isLast ? (
            <button type="button" className="hl-btn hl-btn-main" style={{ flex: "2 1 180px", width: "auto" }} disabled={busy}
              onClick={() => (skipped > 0 ? setConfirming(true) : submit())}>
              <Flag size={19} /> {busy ? "Sending…" : "Finish quiz!"}
            </button>
          ) : (
            <button type="button" className="hl-btn hl-btn-sun" style={{ flex: "2 1 180px" }} disabled={busy}
              onClick={() => setIndex(i => i + 1)}>
              Next <ChevronRight size={19} />
            </button>
          )}
        </div>

        {confirming && (
          <div role="alertdialog" aria-label="Finish the quiz?" style={{ marginTop: 18, padding: 16, borderRadius: 16, border: `2.5px solid ${HERO.ink}`, background: "#FFF7D6" }}>
            <p style={{ margin: "0 0 12px", fontWeight: 700 }}>
              You skipped {skipped} question{skipped !== 1 ? "s" : ""}. Finish anyway?
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="hl-btn hl-btn-soft" onClick={() => { setConfirming(false); setIndex(answers.findIndex(a => a < 0)); }}>
                Go to skipped
              </button>
              <button type="button" className="hl-btn hl-btn-main" style={{ width: "auto", fontSize: 16, padding: "10px 18px" }} onClick={() => submit()}>
                Yes, finish
              </button>
            </div>
          </div>
        )}
        {error && <p className="hl-error" role="alert">{error}</p>}
      </section>

      {/* Jump to any question */}
      {total > 1 && (
        <section className="hl-card" style={{ padding: 18 }}>
          <p style={{ margin: "0 0 12px", textAlign: "center", fontWeight: 700, fontSize: 14, color: HERO.inkSoft }}>
            {answeredCount} of {total} answered
          </p>
          <div className="ql-dots">
            {answers.map((a, i) => (
              <button key={i} type="button" onClick={() => setIndex(i)} disabled={busy}
                className={`ql-dot${a >= 0 ? " answered" : ""}${i === index ? " current" : ""}`}
                aria-label={`Question ${i + 1}${a >= 0 ? ", answered" : ""}`} aria-current={i === index ? "step" : undefined}>
                {i + 1}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ── 3. Results + review ───────────────────────────────────────────────────────
function Results({ quiz, celebrate }) {
  const r = quiz.result;
  const stamp = scoreStamp(r.percentage);
  const burst = r.percentage >= 90 ? ["SUPER", "HERO!"] : r.percentage >= 75 ? ["GREAT", "JOB!"] : r.percentage >= 50 ? ["WELL", "DONE!"] : ["GOOD", "TRY!"];

  return (
    <>
      {celebrate && <Celebration />}
      <section className="hl-card" style={{ background: HERO.greenPale, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
          <PowBurst lines={burst} size={170} />
        </div>
        <p style={{ margin: 0, fontFamily: HERO_FONTS.heading, fontWeight: 700, fontSize: 44, lineHeight: 1.1 }}>
          {r.score} / {r.totalQuestions}
        </p>
        <p style={{ margin: "6px 0 2px", fontWeight: 700, fontSize: 17 }}>{r.percentage}% correct · {stamp}</p>
        {r.timeTaken != null && <p className="hl-muted" style={{ margin: "0 0 14px", fontSize: 14 }}>Finished in {fmtDuration(r.timeTaken)}</p>}
        <p className="hl-muted" style={{ margin: 0, fontSize: 15 }}>Your teacher will send your report to your parent.</p>
      </section>

      <section className="hl-card" style={{ animationDelay: ".1s" }}>
        <h2 className="hl-h2"><span className="hl-ico" style={{ background: HERO.sun }}>🔍</span> Check your answers</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {quiz.questions.map((q, i) => {
            const given = r.answers?.[i];
            const ok = given === q.correctIndex;
            return (
              <div key={i} className="ql-review">
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span className="ql-mark" style={{ background: ok ? HERO.green : HERO.red }} aria-label={ok ? "Correct" : "Not correct"}>
                    {ok ? <Check size={17} strokeWidth={3.5} /> : <XIcon size={17} strokeWidth={3.5} />}
                  </span>
                  <p style={{ margin: "3px 0 0", fontWeight: 700, fontSize: 16, lineHeight: 1.45 }}>{i + 1}. {q.question}</p>
                </div>
                {q.options.map((o, oi) => {
                  const right = oi === q.correctIndex, chosen = oi === given;
                  return (
                    <div key={oi} className={`ql-ropt${right ? " right" : chosen ? " wrong" : ""}`}>
                      <span className="ql-letter" style={{ width: 28, height: 28, fontSize: 14, borderRadius: 9, background: OPTION_COLORS[oi] }}>{LETTERS[oi]}</span>
                      <span>{o.text}</span>
                      {right && <span className="ql-tag" style={{ color: "#138A5A" }}>✓ Right answer</span>}
                      {!right && chosen && <span className="ql-tag" style={{ color: HERO.redDeep }}>Your answer</span>}
                    </div>
                  );
                })}
                {given < 0 && <p className="hl-muted" style={{ margin: "8px 0 0", fontSize: 14 }}>You skipped this one.</p>}
                {q.explanation && (
                  <div className="ql-tip"><Lightbulb size={18} color={HERO.sunDeep} style={{ flexShrink: 0, marginTop: 1 }} /><span>{q.explanation}</span></div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
