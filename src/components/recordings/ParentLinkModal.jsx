// src/components/recordings/ParentLinkModal.jsx
// "Parent link" for one recorded class (teacher and admin Recordings tabs).
// One link per student: copy it, switch it off / on, or email it now. Families open
// it at /rv/<token>, confirm the names and watch (pages/recording-link/RecordingLinkPage).
// Server: server/routes/recordingLinkRoutes.js.
//
// Text: the admin tab passes ns="admin" (keys under recordingLink.*); the teacher tab,
// which isn't translated yet, gets the English defaults.
import { useState, useEffect, useCallback } from "react";
import { X, Link2, Copy, Mail, Power, CheckCircle2, MailX } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../api";
import { dateLocale } from "../../i18n/dateLocale.js";

const fmtDay = (d) => new Date(d).toLocaleDateString(dateLocale("en-GB"), { day: "numeric", month: "short", year: "numeric" });
const fmtWhen = (d) => new Date(d).toLocaleString(dateLocale("en-GB"), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const parentLinkUrl = (token) => `${window.location.origin}/rv/${token}`;

/**
 * @param cls    { bookingId } or { groupClassId }
 * @param title  class title shown in the header
 */
export default function ParentLinkModal({ cls, title, isDarkMode, onClose, ns }) {
  const { t } = useTranslation(ns);
  const tr = (key, def, opts) => t(`recordingLink.${key}`, def, opts);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const col = {
    card:   isDarkMode ? "var(--as-raised, #1a1d2e)" : "var(--as-surface, #ffffff)",
    border: isDarkMode ? "var(--as-line, #2a2d40)" : "var(--as-line, #e8edf5)",
    text:   isDarkMode ? "var(--as-ink, #e8eaf6)" : "var(--as-ink, #1a1d2e)",
    muted:  isDarkMode ? "var(--as-muted, #8b91b8)" : "var(--as-ink-2, #6b7280)",
    soft:   isDarkMode ? "rgba(255,255,255,0.04)" : "var(--as-raised, #f6f7fb)",
    accent: "var(--as-accent, #6366f1)",
  };
  const btn = (primary) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    ...(primary ? { background: col.accent, color: "#fff", border: "none" } : { background: "none", color: col.text, border: `1px solid ${col.border}` }),
  });

  const params = cls.bookingId ? { bookingId: cls.bookingId } : { groupClassId: cls.groupClassId };
  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get("/recording-links/class", { params });
      setData(res.data); setError("");
    } catch (err) {
      setError(err?.response?.data?.message || tr("loadFailed", "Couldn't load the parent links"));
    }
  }, [cls.bookingId, cls.groupClassId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(""), 3000); };
  const run = async (key, fn, okMsg) => {
    setBusy(key); setError("");
    try {
      const { data: res } = await fn();
      if (res?.data) setData(res.data);
      if (okMsg) flash(okMsg);
      return res?.data;
    } catch (err) {
      setError(err?.response?.data?.message || tr("actionFailed", "Something went wrong — please try again"));
      return null;
    } finally { setBusy(""); }
  };

  const copy = async (token) => {
    const url = parentLinkUrl(token);
    try { await navigator.clipboard.writeText(url); flash(tr("copied", "Link copied — paste it into a message to the family")); }
    catch { window.prompt(tr("copyManually", "Copy this link:"), url); }
  };

  const copyNew = async (s) => {
    const res = await run(`make-${s.studentId}`, () => api.post("/recording-links/class", { ...params, studentId: s.studentId }));
    const token = res?.students?.find((x) => String(x.studentId) === String(s.studentId))?.link?.token;
    if (token) await copy(token);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={tr("title", "Parent link")}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", background: col.card, color: col.text, borderRadius: 18, border: `1px solid ${col.border}`, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "18px 20px", borderBottom: `1px solid ${col.border}` }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "color-mix(in srgb, var(--as-accent, #6366f1) 14%, transparent)", color: col.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Link2 size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{tr("title", "Parent link")}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: col.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
          </div>
          <button onClick={onClose} aria-label={tr("close", "Close")} style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: "16px 20px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: col.muted, lineHeight: 1.55 }}>
            {tr("help", "The family opens the link, confirms the student's and teacher's names, and watches the class on their phone. Nobody needs to log in.")}
          </p>

          {!data && !error && <p style={{ fontSize: 13, color: col.muted }}>{tr("loading", "Loading…")}</p>}

          {data && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 12, background: col.soft, fontSize: 12, marginBottom: 14 }}>
                {data.expiresAt && <span>⏳ {tr("availableUntil", "Videos are kept until {{date}} — the link stops working then.", { date: fmtDay(data.expiresAt) })}</span>}
                <span>
                  {data.autoEmail
                    ? <>📧 {tr("autoOn", "Automatic email is on: managed students with an email address get this link after the class.")}</>
                    : <>🔕 {tr("autoOff", "Automatic email is switched off for this center. You can still copy or email the link here.")}</>}
                </span>
              </div>

              {!data.hasVideo && <p style={{ fontSize: 13, color: col.muted }}>{tr("noVideo", "This class has no recording yet.")}</p>}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.students.map((s) => {
                  const l = s.link;
                  const off = l && !l.enabled;
                  return (
                    <div key={s.studentId} style={{ border: `1px solid ${col.border}`, borderRadius: 12, padding: "12px 14px", opacity: off ? 0.75 : 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 14 }}>{s.studentName}</strong>
                        {off && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "rgba(239,68,68,0.12)", color: "#dc2626" }}>{tr("switchedOff", "Link off")}</span>}
                        {l?.emailedAt && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(16,185,129,0.12)", color: "#059669", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <CheckCircle2 size={11} /> {tr("emailedOn", "Emailed {{date}}", { date: fmtWhen(l.emailedAt) })}{l.emailedManual ? "" : ` · ${tr("auto", "auto")}`}
                          </span>
                        )}
                        {s.isManaged && !s.hasEmail && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: col.soft, color: col.muted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <MailX size={11} /> {tr("noEmail", "No email address")}
                          </span>
                        )}
                      </div>
                      {s.email && <p style={{ margin: "4px 0 0", fontSize: 12, color: col.muted }}>{s.email}</p>}

                      {data.hasVideo && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          {l?.token ? (
                            <button style={btn(true)} disabled={!!busy || off} onClick={() => copy(l.token)}><Copy size={13} /> {tr("copy", "Copy link")}</button>
                          ) : (
                            <button style={btn(true)} disabled={!!busy} onClick={() => copyNew(s)}>
                              <Copy size={13} /> {busy === `make-${s.studentId}` ? tr("making", "Making link…") : tr("makeCopy", "Create & copy link")}
                            </button>
                          )}
                          {l && (
                            <button style={btn(false)} disabled={!!busy}
                              onClick={() => run(`toggle-${l.id}`, () => api.patch(`/recording-links/${l.id}`, { enabled: off }),
                                off ? tr("onDone", "Link switched on") : tr("offDone", "Link switched off — it no longer opens"))}>
                              <Power size={13} /> {off ? tr("turnOn", "Switch on") : tr("turnOff", "Switch off")}
                            </button>
                          )}
                          {s.hasEmail && (
                            <button style={btn(false)} disabled={!!busy || off}
                              onClick={async () => {
                                // Already sent (automatically or by hand)? Ask before sending it again
                                if (l?.emailedAt && !window.confirm(l.emailedManual
                                  ? tr("confirmAgain", "This video link was already emailed on {{date}}. Send it again?", { date: fmtWhen(l.emailedAt) })
                                  : tr("confirmAgainAuto", "This video link was already emailed automatically on {{date}}. Send it again?", { date: fmtWhen(l.emailedAt) }))) return;
                                let id = l?.id;
                                if (!id) {
                                  const res = await run(`make-${s.studentId}`, () => api.post("/recording-links/class", { ...params, studentId: s.studentId }));
                                  id = res?.students?.find((x) => String(x.studentId) === String(s.studentId))?.link?.id;
                                }
                                if (id) await run(`email-${id}`, () => api.post(`/recording-links/${id}/email`), tr("emailSent", "Email sent to the family"));
                              }}>
                              <Mail size={13} /> {l?.emailedAt ? tr("emailAgain", "Email again") : tr("emailNow", "Email now")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {notice && <p role="status" style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 700, color: "#059669" }}>{notice}</p>}
          {error && <p role="alert" style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
