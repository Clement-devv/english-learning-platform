// src/components/hero/HeroLinkKit.jsx
// Shared building blocks for the kids' share-link pages (homework, quiz):
// page shell + styles, the "Hero check!" name gate, notices, and the session hook.
// Server side: server/utils/shareLink.js.
import { useState, useEffect } from "react";
import { Rocket } from "lucide-react";
import api from "../../api";
import { HERO, HERO_FONTS } from "./heroTheme";
import { HERO_CSS, HeroSky, StarBuddy, FlyingHero } from "./HeroScene";

export const ACCESS_HEADER = "x-share-access";

// ── Styles (scoped with the "hl-" prefix) ─────────────────────────────────────
export const HERO_PAGE_CSS = `
${HERO_CSS}
.hl-page { min-height: 100vh; position: relative; font-family: ${HERO_FONTS.body}; color: ${HERO.ink}; }
.hl-wrap { position: relative; z-index: 1; max-width: 560px; margin: 0 auto; padding: 28px 16px 56px; display: flex; flex-direction: column; gap: 20px; }
.hl-card { background: ${HERO.paper}; border: 3px solid ${HERO.ink}; border-radius: 24px; box-shadow: 6px 6px 0 ${HERO.ink}; padding: 24px; animation: hl-rise .45s ease-out both; }
.hl-h1 { font-family: ${HERO_FONTS.heading}; font-weight: 700; font-size: 28px; line-height: 1.2; margin: 0; }
.hl-h2 { font-family: ${HERO_FONTS.heading}; font-weight: 700; font-size: 20px; line-height: 1.3; margin: 0 0 14px; display: flex; align-items: center; gap: 10px; }
.hl-h2 .hl-ico { width: 36px; height: 36px; border-radius: 12px; border: 2.5px solid ${HERO.ink}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.hl-muted { color: ${HERO.inkSoft}; }
.hl-label { display: block; font-weight: 700; font-size: 15px; margin: 0 0 8px; }
.hl-input { width: 100%; box-sizing: border-box; padding: 14px 16px; border: 3px solid ${HERO.ink}; border-radius: 16px; font: 500 17px ${HERO_FONTS.body}; color: ${HERO.ink}; background: #fff; transition: box-shadow .15s; }
.hl-input::placeholder { color: #9AA3C2; }
.hl-input:focus { outline: none; box-shadow: 0 0 0 5px ${HERO.sun}; }
.hl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; border: 3px solid ${HERO.ink}; border-radius: 18px; padding: 15px 22px; font: 700 18px ${HERO_FONTS.heading}; cursor: pointer; box-shadow: 4px 4px 0 ${HERO.ink}; transition: transform .08s, box-shadow .08s; text-decoration: none; }
.hl-btn:hover { transform: translate(-1px,-1px); box-shadow: 5px 5px 0 ${HERO.ink}; }
.hl-btn:active { transform: translate(3px,3px); box-shadow: 1px 1px 0 ${HERO.ink}; }
.hl-btn:focus-visible { outline: 4px solid ${HERO.sun}; outline-offset: 3px; }
.hl-btn:disabled { opacity: .65; cursor: not-allowed; transform: none; }
.hl-btn-main { background: ${HERO.red}; color: #fff; width: 100%; }
.hl-btn-sun  { background: ${HERO.sun}; color: ${HERO.ink}; }
.hl-btn-soft { background: #fff; color: ${HERO.ink}; font-size: 15px; padding: 10px 16px; border-radius: 14px; box-shadow: 3px 3px 0 ${HERO.ink}; }
.hl-chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 2.5px solid ${HERO.ink}; border-radius: 999px; font-weight: 700; font-size: 14px; background: ${HERO.sun}; }
.hl-error { margin: 14px 0 0; padding: 10px 14px; border-radius: 12px; background: #FFE8E9; border: 2px solid ${HERO.redDeep}; color: ${HERO.redDeep}; font-weight: 600; font-size: 14px; }
@media (max-width: 420px) { .hl-card { padding: 20px 18px; border-radius: 20px; } .hl-h1 { font-size: 24px; } }
`;

// Keep the link out of search engines and out of Referer headers to other
// sites; load the theme fonts.
function usePageHead() {
  useEffect(() => {
    const els = [["robots", "noindex, nofollow"], ["referrer", "no-referrer"]].map(([name, content]) => {
      const m = document.createElement("meta");
      m.name = name; m.content = content;
      return document.head.appendChild(m);
    });
    const font = document.createElement("link");
    font.rel = "stylesheet"; font.href = HERO_FONTS.cssHref;
    els.push(document.head.appendChild(font));
    return () => els.forEach(e => e.remove());
  }, []);
}

/** Page shell: animated sky, shared styles, private-page head tags. */
export function HeroPage({ extraCss = "", children }) {
  usePageHead();
  return (
    <div className="hl-page">
      <style>{HERO_PAGE_CSS + extraCss}</style>
      <HeroSky />
      <main className="hl-wrap">{children}</main>
    </div>
  );
}

export function HeroLoading({ text = "Loading your mission…" }) {
  return (
    <div style={{ textAlign: "center", marginTop: 90 }}>
      <StarBuddy size={72} style={{ animation: "hl-bounce 1s ease-in-out infinite" }} />
      <p style={{ fontFamily: HERO_FONTS.heading, fontSize: 20, fontWeight: 700 }}>{text}</p>
    </div>
  );
}

export function HeroNotice({ title, text }) {
  return (
    <div className="hl-card" style={{ textAlign: "center", marginTop: 60 }}>
      <StarBuddy size={84} mood="sad" style={{ marginBottom: 8 }} />
      <h1 className="hl-h1" style={{ fontSize: 24, marginBottom: 10 }}>{title}</h1>
      <p className="hl-muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

// ── Name gate ─────────────────────────────────────────────────────────────────
export function HeroGate({ unlockPath, subtitle, onUnlocked, onFailure, title = "Hero check!", studentLabel = "Your name", teacherLabel = "Your teacher's name", buttonLabel = "Start my mission!" }) {
  const [studentName, setStudentName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { data } = await api.post(unlockPath, { studentName, teacherName });
      onUnlocked(data);
    } catch (err) {
      if (!onFailure(err)) setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="hl-card" style={{ marginTop: 64, position: "relative", paddingTop: 40 }}>
      {/* hero peeking over the card */}
      <div style={{ position: "absolute", top: -74, left: "50%", transform: "translateX(-50%)" }}>
        <div className="hl-anim" style={{ animation: "hl-bob 1.8s ease-in-out infinite" }}>
          <FlyingHero variant="red" size={170} />
        </div>
      </div>

      <h1 className="hl-h1" style={{ textAlign: "center" }}>{title}</h1>
      <p className="hl-muted" style={{ textAlign: "center", margin: "10px 0 26px", fontSize: 16, lineHeight: 1.55 }}>
        {subtitle}<br />Tell us who you are to open it.
      </p>

      <label className="hl-label" htmlFor="hl-student">{studentLabel}</label>
      <input id="hl-student" className="hl-input" value={studentName} onChange={e => setStudentName(e.target.value)}
        required maxLength={100} autoComplete="off" placeholder="e.g. Linh" />

      <label className="hl-label" htmlFor="hl-teacher" style={{ marginTop: 18 }}>{teacherLabel}</label>
      <input id="hl-teacher" className="hl-input" value={teacherName} onChange={e => setTeacherName(e.target.value)}
        required maxLength={100} autoComplete="off" placeholder="e.g. Emma" />

      {error && <p className="hl-error" role="alert">{error}</p>}

      <button type="submit" disabled={busy} className="hl-btn hl-btn-main" style={{ marginTop: 26 }}>
        <Rocket size={20} /> {busy ? "Checking…" : buttonLabel}
      </button>
    </form>
  );
}

// ── Session hook ──────────────────────────────────────────────────────────────
/**
 * Handles the share-link lifecycle for a page:
 *   phase: loading | gate | view | invalid | expired
 * `basePath` e.g. "/quiz/link/<token>"; `dataKey` is the response field ("quiz", "homework").
 * The access token is kept in sessionStorage for this tab so a refresh stays unlocked.
 */
export function useShareLinkSession({ basePath, dataKey, storageKey }) {
  const [phase, setPhase]     = useState("loading");
  const [message, setMessage] = useState("");
  const [data, setData]       = useState(null);
  const [access, setAccess]   = useState(null);

  const headers = (a = access) => ({ [ACCESS_HEADER]: a });
  const forget  = () => { try { sessionStorage.removeItem(storageKey); } catch { /* storage unavailable */ } };

  // Returns true if the error was handled (page state changed)
  const onFailure = (err) => {
    const status = err?.response?.status;
    const msg    = err?.response?.data?.message;
    if (status === 410) { setPhase("expired"); setMessage(msg); return true; }
    if (status === 404) { setPhase("invalid"); setMessage(msg); return true; }
    if (status === 403 && access) { forget(); setAccess(null); setPhase("gate"); return true; }
    return false;
  };

  // Restore an unlocked session for this tab (e.g. after a refresh)
  useEffect(() => {
    let saved = null;
    try { saved = sessionStorage.getItem(storageKey); } catch { /* storage unavailable */ }
    if (!saved) { setPhase("gate"); return; }
    api.get(basePath, { headers: headers(saved) })
      .then(({ data: res }) => { setAccess(saved); setData(res[dataKey]); setPhase("view"); })
      .catch((err) => {
        forget();
        const status = err?.response?.status;
        if (status === 410) { setPhase("expired"); setMessage(err.response.data?.message); }
        else if (status === 404) { setPhase("invalid"); setMessage(err.response.data?.message); }
        else setPhase("gate");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  const onUnlocked = (res) => {
    try { sessionStorage.setItem(storageKey, res.accessToken); } catch { /* storage unavailable */ }
    setAccess(res.accessToken);
    setData(res[dataKey]);
    setPhase("view");
  };

  return { phase, message, data, setData, headers, onUnlocked, onFailure };
}
