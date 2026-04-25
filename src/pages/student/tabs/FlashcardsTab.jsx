// src/pages/student/tabs/FlashcardsTab.jsx
import { useState, useEffect, useCallback } from "react";
import api from "../../../api";
import StreakToast from "../components/StreakToast";
import { Layers, CheckCircle2, Clock, Trophy, ChevronLeft, ArrowRight } from "lucide-react";

const HEADING = "#3d2e20";
const MUTED   = "#a89480";
const ACCENT  = "#f97316";
const BORDER  = "#ffe8cc";
const HEROG   = "linear-gradient(135deg,#f97316,#f43f5e)";
const DECK_COLORS = ["#f97316", "#f43f5e", "#f59e0b", "#fb923c", "#ef4444"];

function ProgressRing({ pct, color, size = 80 }) {
  const r    = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={BORDER} strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ-dash}`} transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="central"
        fill={color} fontWeight="900" fontSize="16" fontFamily="'Nunito',sans-serif">{pct}%</text>
    </svg>
  );
}

export default function FlashcardsTab({ isDarkMode }) {
  const [stats,       setStats]       = useState([]);
  const [cards,       setCards]       = useState([]);
  const [mode,        setMode]        = useState("home");
  const [idx,         setIdx]         = useState(0);
  const [flipped,     setFlipped]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [reviewed,    setReviewed]    = useState(0);
  const [streakToast, setStreakToast] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, dueRes] = await Promise.allSettled([
        api.get("/vocab/stats"),
        api.get("/vocab/due"),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data.stats || []);
      if (dueRes.status  === "fulfilled")  setCards(dueRes.value.data.cards   || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalDue      = cards.length;
  const totalWords    = stats.reduce((s, d) => s + (d.total    || 0), 0);
  const totalMastered = stats.reduce((s, d) => s + (d.mastered || 0), 0);
  const totalNew      = stats.reduce((s, d) => s + (d.newCards || 0), 0);
  const overallPct    = totalWords > 0 ? Math.round((totalMastered / totalWords) * 100) : 0;

  const startReview = () => { setIdx(0); setFlipped(false); setReviewed(0); setMode("review"); };

  const submitRating = async (quality) => {
    const card = cards[idx];
    try {
      const { data } = await api.post("/vocab/review", { listId: card.listId, wordId: card.wordId, quality });
      if (data?.streak?.incremented) setStreakToast(data.streak);
    } catch { /* silent */ }
    const next = idx + 1;
    setReviewed(r => r + 1);
    if (next >= cards.length) { setMode("done"); fetchData(); }
    else { setIdx(next); setFlipped(false); }
  };

  // ── Done ────────────────────────────────────────────────────────────────────
  if (mode === "done") return (
    <div style={{ padding: "28px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: "'Nunito',sans-serif", minHeight: 400 }}>
      <div style={{ width: 96, height: 96, borderRadius: "50%", background: HEROG, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: "0 20px 40px rgba(249,115,22,0.35)" }}>
        <Trophy size={48} stroke="#fff" strokeWidth={2.2}/>
      </div>
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: HEADING, letterSpacing: "-0.4px" }}>Session complete!</h2>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: MUTED, fontWeight: 700, maxWidth: 380 }}>
        You reviewed <strong style={{ color: ACCENT }}>{reviewed} card{reviewed !== 1 ? "s" : ""}</strong>. Great work! Come back tomorrow for your next batch.
      </p>
      <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => setMode("home")} style={{ padding: "12px 22px", borderRadius: 999, background: HEROG, color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 900, boxShadow: "0 8px 18px rgba(249,115,22,0.35)", fontFamily: "inherit" }}>Back to decks</button>
        <button onClick={startReview}            style={{ padding: "12px 22px", borderRadius: 999, background: "#fff", color: "#5a4a3a", border: `2px solid ${BORDER}`, cursor: "pointer", fontSize: 14, fontWeight: 900, fontFamily: "inherit" }}>Review again</button>
      </div>
    </div>
  );

  // ── Review ───────────────────────────────────────────────────────────────────
  if (mode === "review") {
    const card     = cards[idx];
    const progress = Math.round((idx / cards.length) * 100);
    return (
      <div style={{ padding: "0 0 28px", maxWidth: 600, margin: "0 auto", fontFamily: "'Nunito',sans-serif" }}>
        <StreakToast data={streakToast} onDone={() => setStreakToast(null)} />
        <style>{`
          .sfc-card { cursor: pointer; user-select: none; }
          @keyframes sfcFlip { 0%{transform:rotateY(90deg);opacity:0} 60%{opacity:1} 100%{transform:rotateY(0deg);opacity:1} }
          .sfc-face { animation: sfcFlip .35s cubic-bezier(.2,.9,.3,1.2); }
        `}</style>

        {/* Progress header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => setMode("home")} style={{ width: 38, height: 38, borderRadius: "50%", border: `2px solid ${BORDER}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ChevronLeft size={16} stroke="#5a4a3a"/>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: HEADING, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card?.listTitle || "Flashcards"}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: MUTED, flexShrink: 0 }}>{idx + 1} / {cards.length}</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: BORDER, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", borderRadius: 999, background: HEROG, transition: "width .4s" }}/>
            </div>
          </div>
        </div>

        {/* Card face */}
        <div className="sfc-card" onClick={() => setFlipped(f => !f)}>
          {!flipped ? (
            <div className="sfc-face" style={{ borderRadius: 28, background: HEROG, padding: "48px 32px", textAlign: "center", boxShadow: "0 20px 50px rgba(249,115,22,0.35)", position: "relative", overflow: "hidden", minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }}/>
              <div style={{ position: "absolute", bottom: -40, left: -20, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }}/>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.12em", position: "relative" }}>Word</p>
              <h2 style={{ margin: "12px 0 0", fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: "-1px", position: "relative" }}>{card?.word}</h2>
              <p style={{ margin: "28px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.75)", fontWeight: 700, position: "relative" }}>Tap to flip →</p>
            </div>
          ) : (
            <div className="sfc-face" style={{ borderRadius: 28, background: "#fff", border: `2px solid ${BORDER}`, padding: "40px 32px", textAlign: "center", boxShadow: "0 20px 40px rgba(61,46,32,0.08)", minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.12em" }}>Definition</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: HEADING, lineHeight: 1.4, maxWidth: 420 }}>{card?.definition}</p>
              {card?.example && (
                <div style={{ padding: "12px 18px", background: "#fff8f0", borderLeft: "3px solid #f97316", borderRadius: "8px 14px 14px 8px", maxWidth: 420 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#5a4a3a", fontStyle: "italic", fontWeight: 600, lineHeight: 1.5 }}>"{card.example}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        {flipped ? (
          <div style={{ marginTop: 24 }}>
            <p style={{ margin: "0 0 12px", textAlign: "center", fontSize: 13, fontWeight: 800, color: HEADING }}>How well did you know it?</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { q: 0, l: "Forgot", sub: "< 1 day",  bg: "#ef4444" },
                { q: 1, l: "Hard",   sub: "1–2 days", bg: "#f97316" },
                { q: 2, l: "Good",   sub: "4 days",   bg: "#3b82f6" },
                { q: 3, l: "Easy",   sub: "1 week+",  bg: "#059669" },
              ].map(btn => (
                <button key={btn.q} onClick={() => submitRating(btn.q)}
                  style={{ padding: "12px 6px", borderRadius: 14, background: btn.bg, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 900, boxShadow: `0 6px 14px ${btn.bg}55`, fontFamily: "inherit", lineHeight: 1.2, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  {btn.l}
                  <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>{btn.sub}</span>
                </button>
              ))}
            </div>
            <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 11, color: MUTED, fontWeight: 700 }}>Spaced repetition — harder words come back sooner</p>
          </div>
        ) : (
          <p style={{ margin: "20px 0 0", textAlign: "center", fontSize: 13, color: MUTED, fontWeight: 700 }}>Think of the meaning, then tap to reveal.</p>
        )}
      </div>
    );
  }

  // ── Home ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: "'Nunito',sans-serif" }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.1em" }}>Learning</div>
        <h1 style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 900, color: HEADING, letterSpacing: "-0.4px" }}>Flashcards</h1>
        <div style={{ fontSize: 14, color: MUTED, fontWeight: 600, marginTop: 4 }}>
          {loading ? "Loading…" : `${totalDue} cards due · ${totalMastered} of ${totalWords} words mastered`}
        </div>
      </div>

      {/* Hero start-review banner */}
      {!loading && (
        <div style={{ background: HEROG, borderRadius: 24, padding: "24px 28px", color: "#fff", display: "flex", alignItems: "center", gap: 22, boxShadow: "0 18px 42px rgba(249,115,22,0.28)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -30, top: -40, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }}/>
          <div style={{ position: "absolute", right: 60, bottom: -50, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }}/>
          <div style={{ position: "relative", width: 80, height: 100, flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(255,255,255,0.2)", transform: "rotate(-8deg) translateX(-6px)" }}/>
            <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(255,255,255,0.35)", transform: "rotate(4deg) translateX(4px)" }}/>
            <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.15)" }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: ACCENT, letterSpacing: "-1px" }}>Aa</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.1em", opacity: 0.9 }}>TODAY'S REVIEW</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2, letterSpacing: "-0.4px" }}>
              {totalDue > 0 ? `${totalDue} cards ready to review` : "All caught up! 🎉"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.95, marginTop: 4 }}>
              {totalDue > 0 ? "Spaced repetition · keeps your streak alive" : "No cards due right now. Check back tomorrow!"}
            </div>
          </div>
          {totalDue > 0 && (
            <button onClick={startReview} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, padding: "14px 24px", borderRadius: 999, border: "none", background: "#fff", color: "#c2410c", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 10px 24px rgba(0,0,0,0.15)", flexShrink: 0 }}>
              Start review <ArrowRight size={14} stroke="#c2410c"/>
            </button>
          )}
        </div>
      )}

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { icon: <Layers size={20} stroke="#c2410c" strokeWidth={2.2}/>,      n: loading ? "—" : totalWords,    l: "Total words",  bg: "#fff3e6", fg: "#c2410c" },
          { icon: <CheckCircle2 size={20} stroke="#059669" strokeWidth={2.2}/>, n: loading ? "—" : totalMastered, l: "Mastered",     bg: "#ecfdf5", fg: "#059669" },
          { icon: <Clock size={20} stroke="#a16207" strokeWidth={2.2}/>,        n: loading ? "—" : totalDue,      l: "Due today",    bg: "#fef3c7", fg: "#a16207" },
          { icon: <Trophy size={20} stroke="#be185d" strokeWidth={2.2}/>,       n: loading ? "—" : stats.length,  l: "Word decks",   bg: "#fce7f3", fg: "#be185d" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 18, padding: "14px 16px", border: `2px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: HEADING, letterSpacing: "-0.3px", lineHeight: 1.1 }}>{s.n}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED }}>{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall mastery callout */}
      {!loading && stats.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 20, border: `2px solid ${BORDER}`, padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
          <ProgressRing pct={overallPct} color={ACCENT} size={80}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: HEADING, letterSpacing: "-0.3px" }}>Overall vocabulary mastery</h3>
            <p style={{ margin: "4px 0 10px", fontSize: 13, color: MUTED, fontWeight: 600 }}>
              Across all {stats.length} deck{stats.length !== 1 ? "s" : ""} — keep reviewing to move words from seen to mastered.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {[
                { l: "Mastered", v: totalMastered,                                                      c: "#059669" },
                { l: "Learning", v: Math.max(0, totalWords - totalMastered - totalNew),                  c: "#f59e0b" },
                { l: "New",      v: totalNew,                                                            c: "#3b82f6" },
              ].map(x => (
                <div key={x.l} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#5a4a3a" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: x.c }}/>
                  {x.l}: <b style={{ color: x.c }}>{x.v}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Deck grid */}
      {!loading && stats.length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 900, color: HEADING, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Layers size={17} stroke={ACCENT}/> Your word decks
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {stats.map((d, i) => {
              const pct   = d.total ? Math.round((d.mastered / d.total) * 100) : 0;
              const color = DECK_COLORS[i % DECK_COLORS.length];
              return (
                <div key={d.listId} style={{ background: "#fff", borderRadius: 20, border: `2px solid ${BORDER}`, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Layers size={22} stroke={color} strokeWidth={2.2}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: HEADING, letterSpacing: "-0.2px" }}>{d.title}</h4>
                      <div style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{d.total} words · {d.mastered} mastered</div>
                    </div>
                    {d.due > 0 && <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 900, color: "#c2410c", background: "#ffedd5", whiteSpace: "nowrap" }}>{d.due} due</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                    {[
                      { l: "Total",    v: d.total,           c: MUTED },
                      { l: "Seen",     v: d.seen,            c: color },
                      { l: "Mastered", v: d.mastered,        c: "#059669" },
                      { l: "New",      v: d.newCards || 0,   c: "#f59e0b" },
                    ].map(s => (
                      <div key={s.l} style={{ background: "#fffbf5", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: s.c }}>{s.v}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mastery</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: BORDER, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg,${color},#fb923c)` }}/>
                    </div>
                  </div>

                  <button onClick={() => d.due > 0 && startReview()}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", borderRadius: 12, border: "none", background: d.due > 0 ? HEROG : "#fff3e6", color: d.due > 0 ? "#fff" : MUTED, fontSize: 13, fontWeight: 900, cursor: d.due > 0 ? "pointer" : "default", fontFamily: "inherit", boxShadow: d.due > 0 ? "0 6px 14px rgba(249,115,22,0.35)" : "none" }}>
                    {d.due > 0 ? <><ArrowRight size={13} stroke="#fff"/> Review {d.due}</> : "All caught up 🎉"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && stats.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 20, border: `2px dashed ${BORDER}`, padding: 48, textAlign: "center" }}>
          <div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: 20, background: "#fff3e6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers size={28} stroke="#c2410c"/>
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: HEADING }}>No word lists yet</div>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 600, marginTop: 4 }}>Your teacher will add vocabulary lists soon!</div>
        </div>
      )}
    </div>
  );
}
