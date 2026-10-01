// src/pages/attendance-check/AttendanceCheckPage.jsx
// Public page for a parent attendance check (managed students — no login).
// The teacher confirmed the child joined the class; the parent confirms it too.
// "No" opens a dispute for the admin. Reopening the link shows the previous
// answer, which can be changed until the school settles it (No → Yes cancels the
// dispute). Server: server/routes/parentCheckRoutes.js, server/utils/parentCheck.js.
import { useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Clock, UserRound, CheckCircle2, XCircle, MessageSquare } from "lucide-react";
import api from "../../api";
import { HERO, HERO_FONTS } from "../../components/hero/heroTheme";
import { HeroPage, HeroGate, HeroNotice, HeroLoading, useShareLinkSession } from "../../components/hero/HeroLinkKit";

const fmtWhen = (d) => new Date(d).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

const PAGE_CSS = `
.ac-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 2px dashed #D5DBEF; font-size: 16px; }
.ac-row:last-child { border-bottom: none; }
.ac-yes { background: ${HERO.green}; color: #fff; }
.ac-no  { background: #fff; color: ${HERO.redDeep}; }
`;

export default function AttendanceCheckPage() {
  const { token } = useParams();
  const basePath = `/parent-checks/link/${token}`;
  const s = useShareLinkSession({ basePath, dataKey: "check", storageKey: `acAccess:${token?.slice(0, 12)}` });

  return (
    <HeroPage extraCss={PAGE_CSS}>
      {s.phase === "loading" && <HeroLoading text="Loading…" />}
      {s.phase === "invalid" && (
        <HeroNotice title="This link doesn't work" text={s.message || "This link is invalid or has been replaced. Please ask the school for a new link."} />
      )}
      {s.phase === "expired" && (
        <HeroNotice title="This link has expired" text={s.message || "Please contact the school if something is wrong."} />
      )}
      {s.phase === "gate" && (
        <HeroGate
          unlockPath={`${basePath}/unlock`}
          title="Class check"
          subtitle="The school would like to confirm a class."
          studentLabel="Your child's name"
          teacherLabel="Their teacher's name"
          buttonLabel="Continue"
          onUnlocked={s.onUnlocked}
          onFailure={s.onFailure}
        />
      )}
      {s.phase === "view" && s.data && (
        <CheckView basePath={basePath} check={s.data} setCheck={s.setData} headers={s.headers} onFailure={s.onFailure} />
      )}
    </HeroPage>
  );
}

function ClassSummary({ check, title, subtitle }) {
  return (
    <section className="hl-card" style={{ position: "relative" }}>
      {check.centerName && (
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: HERO.inkSoft }}>
          {check.centerName}
        </p>
      )}
      <h1 className="hl-h1" style={{ fontSize: 26 }}>{title}</h1>
      {subtitle && <p className="hl-muted" style={{ margin: "10px 0 16px", fontSize: 15, lineHeight: 1.6 }}>{subtitle}</p>}
      <div style={{ marginTop: subtitle ? 0 : 14 }}>
        <div className="ac-row"><CalendarDays size={20} color={HERO.blue} /> <strong>{check.classTitle}</strong></div>
        <div className="ac-row"><Clock size={20} color={HERO.sunDeep} /> {fmtWhen(check.scheduledTime)} · {check.duration} min</div>
        <div className="ac-row"><UserRound size={20} color={HERO.green} /> Teacher: {check.teacherName}</div>
      </div>
    </section>
  );
}

// Note box + send button for a "No" answer (first answer or a change)
function NoForm({ comment, setComment, busy, onBack, onSend, intro }) {
  return (
    <>
      <h2 className="hl-h2"><span className="hl-ico" style={{ background: HERO.sun }}><MessageSquare size={18} /></span> Anything to add?</h2>
      {intro && <p className="hl-muted" style={{ margin: "-4px 0 14px", fontSize: 14, lineHeight: 1.55 }}>{intro}</p>}
      <label className="hl-label" htmlFor="ac-note">Optional note for the school</label>
      <textarea id="ac-note" className="hl-input" rows={3} maxLength={500} value={comment} onChange={e => setComment(e.target.value)}
        placeholder="e.g. They were sick that day" style={{ resize: "vertical" }} />
      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        <button type="button" className="hl-btn hl-btn-soft" style={{ flex: "1 1 110px" }} disabled={busy} onClick={onBack}>Back</button>
        <button type="button" className="hl-btn hl-btn-main" style={{ flex: "2 1 180px", width: "auto" }} disabled={busy} onClick={onSend}>
          {busy ? "Sending…" : "Send: they didn't attend"}
        </button>
      </div>
    </>
  );
}

function CheckView({ basePath, check, setCheck, headers, onFailure }) {
  const [mode, setMode]       = useState("idle");  // idle | no (first "No") | change (changing an answer)
  const [comment, setComment] = useState("");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState("");
  const [notice, setNotice]   = useState("");

  const answer = async (attended) => {
    setBusy(true); setError(""); setNotice("");
    const wasAnswered = check.status !== "waiting";
    try {
      const { data } = await api.post(`${basePath}/respond`, { attended, comment: attended ? "" : comment.trim() }, { headers: headers() });
      setCheck(data.check);
      setMode("idle"); setComment("");
      if (wasAnswered) setNotice("Your answer was updated. Thank you!");
    } catch (err) {
      if (err?.response?.status === 409) {
        // Changed in the meantime (e.g. the school just reviewed it) — show the latest state
        setError(err.response.data?.message || "This answer can't be changed any more.");
        try { const { data } = await api.get(basePath, { headers: headers() }); setCheck(data.check); } catch { /* keep current */ }
        setMode("idle");
      } else if (!onFailure(err)) {
        setError(err?.response?.data?.message || "Could not send your answer. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // ── First answer ──
  if (check.status === "waiting") {
    return (
      <>
        <ClassSummary check={check} title={`Did ${check.studentName} attend this class?`}
          subtitle={`The teacher marked ${check.studentName} as present. Please let us know if that's right.`} />
        <section className="hl-card" style={{ animationDelay: ".08s" }}>
          {mode !== "no" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button type="button" className="hl-btn ac-yes" disabled={busy} onClick={() => answer(true)}>
                <CheckCircle2 size={22} /> {busy ? "Sending…" : `Yes, ${check.studentName} attended`}
              </button>
              <button type="button" className="hl-btn ac-no" disabled={busy} onClick={() => setMode("no")}>
                <XCircle size={22} /> No, they didn't attend
              </button>
            </div>
          ) : (
            <NoForm comment={comment} setComment={setComment} busy={busy} onBack={() => setMode("idle")} onSend={() => answer(false)} />
          )}
          {error && <p className="hl-error" role="alert">{error}</p>}
          <p className="hl-muted" style={{ margin: "16px 0 0", fontSize: 13, textAlign: "center", fontFamily: HERO_FONTS.body }}>
            You can change your answer later using this same link, until the school reviews it.
          </p>
        </section>
      </>
    );
  }

  // ── Already answered: show it, and allow a change while it's still open ──
  const yes = check.status === "confirmed";
  return (
    <>
      <ClassSummary check={check} title={yes ? "Thank you for confirming!" : "Thank you. We'll look into it"} />

      <section className="hl-card" style={{ animationDelay: ".08s" }}>
        {notice && (
          <p role="status" style={{ margin: "0 0 14px", padding: "10px 14px", borderRadius: 12, background: HERO.greenPale, border: `2px solid ${HERO.green}`, fontWeight: 700, fontSize: 14 }}>
            {notice}
          </p>
        )}

        <p className="hl-label" style={{ marginBottom: 10 }}>Your answer</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, border: `3px solid ${HERO.ink}`,
          background: yes ? HERO.greenPale : "#FFE8E9" }}>
          {yes ? <CheckCircle2 size={28} color={HERO.green} /> : <XCircle size={28} color={HERO.redDeep} />}
          <div>
            <p style={{ margin: 0, fontFamily: HERO_FONTS.heading, fontWeight: 700, fontSize: 18 }}>
              {yes ? `Yes, ${check.studentName} attended` : `No, ${check.studentName} didn't attend`}
            </p>
            {check.respondedAt && (
              <p className="hl-muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                {check.changed ? "Changed" : "Answered"} on {fmtWhen(check.respondedAt)}
              </p>
            )}
          </div>
        </div>
        {!yes && check.comment && <p className="hl-muted" style={{ margin: "10px 0 0", fontSize: 14 }}>Your note: “{check.comment}”</p>}
        <p className="hl-muted" style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.6 }}>
          {yes
            ? `We've recorded that ${check.studentName} attended the class.`
            : "The school has been told and will check what happened. They may contact you."}
        </p>

        {/* Change of answer */}
        {check.canChange && mode === "idle" && (
          <button type="button" className="hl-btn hl-btn-soft" style={{ marginTop: 18 }} onClick={() => { setMode("change"); setError(""); setNotice(""); }}>
            Change my answer
          </button>
        )}

        {check.canChange && mode === "change" && (
          <div style={{ marginTop: 18, padding: 16, borderRadius: 16, border: `2.5px solid ${HERO.ink}`, background: "#FFF7D6" }}>
            {yes ? (
              <NoForm comment={comment} setComment={setComment} busy={busy} onBack={() => setMode("idle")} onSend={() => answer(false)}
                intro={`Change your answer to "No"? This asks the school to review the class.`} />
            ) : (
              <>
                <p style={{ margin: "0 0 6px", fontFamily: HERO_FONTS.heading, fontWeight: 700, fontSize: 18 }}>
                  Change your answer to “Yes, {check.studentName} attended”?
                </p>
                <p className="hl-muted" style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.55 }}>
                  This cancels your report. The class will count as attended.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button type="button" className="hl-btn hl-btn-soft" style={{ flex: "1 1 110px" }} disabled={busy} onClick={() => setMode("idle")}>Keep my answer</button>
                  <button type="button" className="hl-btn ac-yes" style={{ flex: "2 1 180px" }} disabled={busy} onClick={() => answer(true)}>
                    <CheckCircle2 size={20} /> {busy ? "Sending…" : "Yes, they attended"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!check.canChange && (
          <p className="hl-muted" style={{ margin: "16px 0 0", fontSize: 13 }}>
            The school has reviewed this class, so this answer is final. Please contact the school if something is wrong.
          </p>
        )}
        {error && <p className="hl-error" role="alert">{error}</p>}
      </section>
    </>
  );
}
