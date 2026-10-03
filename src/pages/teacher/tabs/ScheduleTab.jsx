// src/pages/teacher/tabs/ScheduleTab.jsx
// Teacher schedule: weekly working hours (→ free time students can book), time
// off, and booked classes — one calendar, in the teacher's own clock.
// Server: server/routes/teacherAvailabilityRoutes.js (calendar, time off),
//         PUT /teachers/:id/working-hours.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Trash2, Clock, Check, AlertCircle, Repeat, Globe, ChevronDown, ChevronUp, Copy, CalendarClock } from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import WeekCalendar, { Legend } from "../../../components/schedule/WeekCalendar";
import ManagedBadge from "../../../components/ManagedBadge";
import { TIMEZONE_OPTIONS } from "../../../utils/timezone";
import {
  getMonday, addDays, localYmd, localHHMM, fmtRange, fmtDay, fmtHHMM, fmtTime, viewerTz, tzName, tzDiffText, WEEKDAYS_SUN0,
} from "../../../utils/scheduleView";

const BRAND = "var(--brand-primary, #7c3aed)";
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun
const HALF_HOURS = Array.from({ length: 49 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`); // 00:00 … 24:00

function pal(dark) {
  return {
    card: dark ? "#111827" : "#ffffff", border: dark ? "#1f2937" : "#e5e7eb", soft: dark ? "#0b1220" : "#f8fafc",
    heading: dark ? "#f1f5f9" : "#0f172a", text: dark ? "#cbd5e1" : "#475569", muted: dark ? "#64748b" : "#94a3b8",
    input: dark ? "#0b1220" : "#ffffff",
  };
}

/** "Mon–Fri 2:00 PM–8:00 PM · Sat 9:00 AM–12:00 PM" */
function summarise(hours) {
  if (!hours?.length) return "";
  const key = (d) => hours.filter(r => r.day === d).map(r => `${r.start}-${r.end}`).join(",");
  const parts = [];
  let i = 0;
  while (i < DAY_ORDER.length) {
    const k = key(DAY_ORDER[i]);
    if (!k) { i++; continue; }
    let j = i;
    while (j + 1 < DAY_ORDER.length && key(DAY_ORDER[j + 1]) === k) j++;
    const name = (d) => WEEKDAYS_SUN0[d].slice(0, 3);
    const days = i === j ? name(DAY_ORDER[i]) : `${name(DAY_ORDER[i])}–${name(DAY_ORDER[j])}`;
    const ranges = hours.filter(r => r.day === DAY_ORDER[i]).map(r => `${fmtHHMM(r.start)}–${fmtHHMM(r.end)}`).join(", ");
    parts.push(`${days} ${ranges}`);
    i = j + 1;
  }
  return parts.join(" · ");
}

export default function ScheduleTab({ teacherInfo, isDarkMode, students = [] }) {
  const c = pal(isDarkMode);
  const myTz = viewerTz();
  const teacherId = teacherInfo?._id || teacherInfo?.id;

  const [weekStart, setWeekStart] = useState(() => getMonday());
  const [cal, setCal] = useState({ free: [], blocks: [], hasHours: false, workingHours: [], timezone: "" });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [visible, setVisible] = useState(teacherInfo?.showScheduleToStudents !== false);
  const [togglingVis, setTogglingVis] = useState(false);

  // Working-hours editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [draftTz, setDraftTz] = useState("");
  const [savingHours, setSavingHours] = useState(false);

  // Time-off modal + detail modal
  const [offModal, setOffModal] = useState(null); // { date: "YYYY-MM-DD", start, end, recurring, studentId, note }
  const [savingOff, setSavingOff] = useState(false);
  const [detail, setDetail] = useState(null);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/teacher-availability/${teacherId}/calendar`, {
        params: { from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() },
      });
      setCal(data);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load schedule", "error");
    } finally { setLoading(false); }
  }, [teacherId, weekStart]);
  useEffect(() => { load(); }, [load]);
  useOnDataChanged(["schedule", "bookings"], load); // live: bookings, time off, hours

  // Open the editor straight away for teachers who haven't set hours yet
  const [autoOpened, setAutoOpened] = useState(false);
  useEffect(() => {
    if (!loading && !autoOpened && cal && cal.timezone !== "" && !cal.hasHours) { openEditor(); setAutoOpened(true); }
  }, [loading, cal]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEditor = () => {
    setDraft((cal.workingHours || []).map(r => ({ ...r })));
    const tz = cal.timezone && cal.timezone !== "UTC" ? cal.timezone : (teacherInfo?.timezone || myTz);
    setDraftTz(tz);
    setEditorOpen(true);
  };

  // ── Working hours ─────────────────────────────────────────────────────────
  const dayRanges = (d) => draft.filter(r => r.day === d);
  const setDay = (d, ranges) => setDraft(prev => [...prev.filter(r => r.day !== d), ...ranges.map(r => ({ ...r, day: d }))]);
  const addRange = (d) => {
    const ranges = dayRanges(d);
    const last = ranges[ranges.length - 1];
    const start = last ? (last.end >= "22:00" ? "22:00" : last.end) : "09:00";
    const end = HALF_HOURS.find(t => t > start && (parseInt(t) - parseInt(start)) >= 2) || "24:00";
    setDay(d, [...ranges, { start, end }]);
  };
  const copyMonToWeekdays = () => {
    const mon = dayRanges(1);
    setDraft(prev => [...prev.filter(r => r.day === 0 || r.day === 6 || r.day === 1), ...[2, 3, 4, 5].flatMap(d => mon.map(r => ({ ...r, day: d })))]);
  };
  const saveHours = async () => {
    for (const d of DAY_ORDER) {
      const rs = dayRanges(d).sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 0; i < rs.length; i++) {
        if (rs[i].end <= rs[i].start) return showToast(`${WEEKDAYS_SUN0[d]}: a range ends before it starts`, "error");
        if (i && rs[i].start < rs[i - 1].end) return showToast(`${WEEKDAYS_SUN0[d]}: two ranges overlap`, "error");
      }
    }
    setSavingHours(true);
    try {
      await api.put(`/teachers/${teacherId}/working-hours`, { workingHours: draft, timezone: draftTz });
      showToast("Working hours saved — students can now book your free time");
      setEditorOpen(false);
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not save working hours", "error");
    } finally { setSavingHours(false); }
  };

  // ── Visibility ────────────────────────────────────────────────────────────
  const toggleVisibility = async () => {
    if (togglingVis) return;
    setTogglingVis(true);
    try {
      await api.patch(`/teachers/${teacherId}/schedule-visibility`, { showScheduleToStudents: !visible });
      setVisible(v => !v);
      showToast(!visible ? "Students can now see and book your free time" : "Your schedule is hidden from students");
    } catch { showToast("Failed to update visibility", "error"); }
    finally { setTogglingVis(false); }
  };

  // ── Time off ──────────────────────────────────────────────────────────────
  const openOff = (at = new Date(Date.now() + 3600000)) => {
    const start = new Date(at); start.setMinutes(start.getMinutes() < 30 ? 0 : 30, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    setOffModal({ date: localYmd(start), start: localHHMM(start), end: end.getDate() !== start.getDate() ? "24:00" : localHHMM(end), recurring: false, studentId: "", note: "" });
    setDetail(null);
  };
  const saveOff = async () => {
    if (offModal.end <= offModal.start) return showToast("End time must be after start time", "error");
    setSavingOff(true);
    try {
      const [y, m, d] = offModal.date.split("-").map(Number);
      await api.post("/teacher-availability", {
        localDate: offModal.date,
        dayOfWeek: new Date(y, m - 1, d).getDay(),
        startTime: offModal.start, endTime: offModal.end,
        isRecurring: offModal.recurring, studentId: offModal.studentId || null, note: offModal.note,
        timezone: myTz, // the times typed are on this device's clock
      });
      setOffModal(null);
      showToast(offModal.studentId ? "Time reserved" : "Time off added");
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not save", "error");
    } finally { setSavingOff(false); }
  };
  const removeOff = async (slotId) => {
    try { await api.delete(`/teacher-availability/${slotId}`); showToast("Removed"); setDetail(null); load(); }
    catch { showToast("Failed to remove", "error"); }
  };

  // ── Calendar data ─────────────────────────────────────────────────────────
  const items = useMemo(() => (cal.blocks || []).map(b => ({
    ...b,
    title: b.kind === "off" ? (b.note || "Time off") : b.kind === "reserved" ? `Reserved · ${b.studentName}` : b.title,
    sub: ["booked", "pending", "done"].includes(b.kind) ? b.studentName : b.kind === "reserved" ? b.note : "",
    onClick: () => setDetail(b),
  })), [cal.blocks]);

  const freeMins = (cal.free || []).reduce((s, f) => s + (new Date(f.end) - new Date(f.start)) / 60000, 0);
  const stat = (k) => (cal.blocks || []).filter(b => b.kind === k).length;
  // Only worth a warning when the clocks actually differ right now
  const tzGap = cal.timezone && cal.timezone !== "UTC" ? tzDiffText(cal.timezone, myTz) : "";
  const tzMismatch = tzGap && tzGap !== "same time as you";

  const sel = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.input, color: c.heading, fontSize: 13, fontFamily: "inherit" };
  const btn = (primary) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    border: primary ? "none" : `1px solid ${c.border}`, background: primary ? BRAND : "transparent", color: primary ? "#fff" : c.heading });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "var(--font-body)" }}>
      {toast && (
        <div role="status" style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 18px", borderRadius: 12, fontSize: 13.5, fontWeight: 600, color: "#fff",
          background: toast.type === "error" ? "#dc2626" : "#059669", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
          {toast.type === "error" ? <AlertCircle size={15} /> : <Check size={15} />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c.heading }}>My Schedule</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: c.text, display: "flex", alignItems: "center", gap: 6 }}>
            <Globe size={13} /> All times are in your time: <strong>{tzName(myTz)}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={toggleVisibility} disabled={togglingVis}
            style={{ ...btn(false), borderColor: visible ? "#10b981" : "#ef4444", color: visible ? "#059669" : "#dc2626" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: visible ? "#10b981" : "#ef4444" }} />
            {visible ? "Students can book you" : "Hidden from students"}
          </button>
          <button type="button" onClick={() => openOff()} style={btn(false)}><Plus size={14} /> Time off</button>
          <button type="button" onClick={editorOpen ? () => setEditorOpen(false) : openEditor} style={btn(true)}>
            <CalendarClock size={14} /> Working hours {editorOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {tzMismatch && (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: isDarkMode ? "rgba(245,158,11,0.12)" : "#fffbeb", border: "1px solid #fcd34d", fontSize: 13, color: isDarkMode ? "#fcd34d" : "#92400e" }}>
          Your working hours are set in <strong>{tzName(cal.timezone)}</strong>, but this device is in <strong>{tzName(myTz)}</strong>.
          ({tzName(cal.timezone).split(" (")[0]} is {tzGap.replace(" you", " this device")}.) The calendar shows this device's time, so your hours appear shifted. If you've moved, change the timezone in Working hours.
        </div>
      )}

      {/* Working hours */}
      {!editorOpen ? (
        <div style={{ padding: "12px 16px", borderRadius: 12, background: c.card, border: `1px solid ${c.border}`, fontSize: 13, color: c.text, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Clock size={15} color={BRAND} />
          {cal.hasHours
            ? <span><strong style={{ color: c.heading }}>Working hours:</strong> {summarise(cal.workingHours)} <span style={{ color: c.muted }}>({tzName(cal.timezone)})</span></span>
            : <span><strong style={{ color: c.heading }}>No working hours yet.</strong> Students can request any time and you approve each one. Set your hours so they see exactly when you're free.</span>}
        </div>
      ) : (
        <div style={{ padding: 16, borderRadius: 14, background: c.card, border: `1.5px solid ${BRAND}`, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: c.heading }}>When do you teach each week?</div>
              <div style={{ fontSize: 12.5, color: c.text }}>Students see these hours as free time (minus classes and time off), shown in their own timezone.</div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: c.text }}>
              Hours are in
              <select value={draftTz} onChange={e => setDraftTz(e.target.value)} style={{ ...sel, maxWidth: 260 }}>
                {!TIMEZONE_OPTIONS.some(o => o.value === draftTz) && draftTz && <option value={draftTz}>{tzName(draftTz)}</option>}
                {TIMEZONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {DAY_ORDER.map(d => {
              const ranges = dayRanges(d);
              const on = ranges.length > 0;
              return (
                <div key={d} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 10, background: on ? c.soft : "transparent" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: on ? c.heading : c.muted, cursor: "pointer" }}>
                    <input type="checkbox" checked={on} onChange={() => (on ? setDay(d, []) : setDay(d, [{ start: "09:00", end: "17:00" }]))} />
                    {WEEKDAYS_SUN0[d]}
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {!on && <span style={{ fontSize: 12.5, color: c.muted }}>Not teaching</span>}
                    {ranges.map((r, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <select aria-label={`${WEEKDAYS_SUN0[d]} start`} value={r.start} onChange={e => setDay(d, ranges.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} style={sel}>
                          {HALF_HOURS.slice(0, -1).map(t => <option key={t} value={t}>{fmtHHMM(t)}</option>)}
                        </select>
                        <span style={{ color: c.muted }}>–</span>
                        <select aria-label={`${WEEKDAYS_SUN0[d]} end`} value={r.end} onChange={e => setDay(d, ranges.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} style={sel}>
                          {HALF_HOURS.slice(1).map(t => <option key={t} value={t}>{fmtHHMM(t)}</option>)}
                        </select>
                        <button type="button" aria-label="Remove range" onClick={() => setDay(d, ranges.filter((_, j) => j !== i))} style={{ ...btn(false), padding: 6 }}><X size={13} /></button>
                      </span>
                    ))}
                    {on && ranges.length < 5 && <button type="button" onClick={() => addRange(d)} style={{ ...btn(false), padding: "5px 10px", fontSize: 12 }}><Plus size={12} /> Add hours</button>}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
            <button type="button" onClick={copyMonToWeekdays} disabled={!dayRanges(1).length} style={{ ...btn(false), opacity: dayRanges(1).length ? 1 : 0.5 }}>
              <Copy size={13} /> Copy Monday to Tue–Fri
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setEditorOpen(false)} style={btn(false)}>Cancel</button>
              <button type="button" onClick={saveHours} disabled={savingHours} style={btn(true)}>{savingHours ? "Saving…" : <><Check size={14} /> Save hours</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats + legend */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["Free this week", cal.hasHours ? `${Math.round(freeMins / 60 * 10) / 10}h` : "—", "#059669"],
            ["Booked", stat("booked"), BRAND],
            ["Pending", stat("pending"), "#d97706"],
          ].map(([l, v, col]) => (
            <span key={l} style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.card, fontSize: 12.5, color: c.text }}>
              <strong style={{ color: col, fontSize: 14 }}>{v}</strong> {l}
            </span>
          ))}
        </div>
        <Legend kinds={["free", "booked", "pending", "off", "reserved"]} isDarkMode={isDarkMode} />
      </div>

      <WeekCalendar
        weekStart={weekStart} onWeekChange={(w) => setWeekStart(w || getMonday())}
        free={cal.free} items={items} loading={loading} isDarkMode={isDarkMode}
        onEmptyClick={(at) => openOff(at)}
        emptyText="Nothing scheduled"
      />
      <p style={{ margin: 0, fontSize: 12, color: c.muted }}>Tip: click an empty time to add time off or reserve it for a student.</p>

      {/* ── Time-off modal ── */}
      {offModal && (
        <div onClick={() => setOffModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Add time off" style={{ background: c.card, borderRadius: 18, width: "100%", maxWidth: 440, padding: 20, display: "flex", flexDirection: "column", gap: 14, border: `1px solid ${c.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: c.heading }}>{offModal.studentId ? "Reserve time" : "Add time off"}</div>
              <button type="button" aria-label="Close" onClick={() => setOffModal(null)} style={{ ...btn(false), padding: 6 }}><X size={15} /></button>
            </div>
            <label style={{ fontSize: 12, fontWeight: 700, color: c.muted }}>Date
              <input type="date" value={offModal.date} min={localYmd(new Date())} onChange={e => setOffModal(m => ({ ...m, date: e.target.value }))} style={{ ...sel, width: "100%", marginTop: 4, boxSizing: "border-box" }} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "end" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: c.muted }}>From
                <select value={offModal.start} onChange={e => setOffModal(m => ({ ...m, start: e.target.value }))} style={{ ...sel, width: "100%", marginTop: 4 }}>
                  {HALF_HOURS.slice(0, -1).map(t => <option key={t} value={t}>{fmtHHMM(t)}</option>)}
                </select>
              </label>
              <span style={{ paddingBottom: 8, color: c.muted }}>–</span>
              <label style={{ fontSize: 12, fontWeight: 700, color: c.muted }}>To
                <select value={offModal.end} onChange={e => setOffModal(m => ({ ...m, end: e.target.value }))} style={{ ...sel, width: "100%", marginTop: 4, borderColor: offModal.end <= offModal.start ? "#ef4444" : c.border }}>
                  {HALF_HOURS.slice(1).map(t => <option key={t} value={t}>{fmtHHMM(t)}</option>)}
                </select>
              </label>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.heading, cursor: "pointer" }}>
              <input type="checkbox" checked={offModal.recurring} onChange={e => setOffModal(m => ({ ...m, recurring: e.target.checked }))} />
              <Repeat size={13} /> Every {WEEKDAYS_SUN0[new Date(offModal.date + "T12:00:00").getDay()]}
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: c.muted }}>Reserve for a student <span style={{ fontWeight: 500 }}>(optional — others can't book it)</span>
              <select value={offModal.studentId} onChange={e => setOffModal(m => ({ ...m, studentId: e.target.value }))} style={{ ...sel, width: "100%", marginTop: 4 }}>
                <option value="">— Just time off —</option>
                {students.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName || ""}{s.isManaged ? " · Managed" : ""}</option>)}
              </select>
            </label>
            <input placeholder="Note (optional), e.g. Doctor's appointment" value={offModal.note} maxLength={300} onChange={e => setOffModal(m => ({ ...m, note: e.target.value }))} style={{ ...sel, width: "100%", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setOffModal(null)} style={btn(false)}>Cancel</button>
              <button type="button" onClick={saveOff} disabled={savingOff || offModal.end <= offModal.start} style={btn(true)}>{savingOff ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail modal ── */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" style={{ background: c.card, borderRadius: 18, width: "100%", maxWidth: 400, padding: 20, display: "flex", flexDirection: "column", gap: 10, border: `1px solid ${c.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: c.muted }}>
                  {{ booked: "Booked class", pending: "Pending request", done: "Completed class", off: "Time off", reserved: "Reserved" }[detail.kind]}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.heading }}>{detail.kind === "off" ? (detail.note || "Time off") : detail.title || detail.studentName}</div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setDetail(null)} style={{ ...btn(false), padding: 6 }}><X size={15} /></button>
            </div>
            <div style={{ fontSize: 14, color: c.heading }}>{fmtDay(detail.start)} · <strong>{fmtRange(detail.start, detail.end)}</strong> <span style={{ color: c.muted }}>your time</span></div>
            {detail.studentName && (
              <div style={{ fontSize: 13.5, color: c.text, display: "flex", alignItems: "center", gap: 6 }}>
                Student: <strong style={{ color: c.heading }}>{detail.studentName}</strong> {detail.isManaged && <ManagedBadge isDarkMode={isDarkMode} />}
              </div>
            )}
            {detail.studentTimezone && detail.studentTimezone !== myTz && (
              <div style={{ fontSize: 13, color: c.text }}>Student's time: <strong>{fmtTime(detail.start, detail.studentTimezone)}</strong> ({tzName(detail.studentTimezone)})</div>
            )}
            {detail.topic && <div style={{ fontSize: 13, color: c.text }}>Topic: {detail.topic}</div>}
            {detail.recurring && <div style={{ fontSize: 12.5, color: c.muted, display: "flex", alignItems: "center", gap: 5 }}><Repeat size={12} /> Repeats every week</div>}
            {detail.kind === "reserved" && detail.note && <div style={{ fontSize: 13, color: c.text }}>Note: {detail.note}</div>}
            {detail.slotId && (
              <button type="button" onClick={() => removeOff(detail.slotId)} style={{ ...btn(false), justifyContent: "center", color: "#dc2626", borderColor: "#fecaca", marginTop: 6 }}>
                <Trash2 size={14} /> {detail.recurring ? "Remove (every week)" : "Remove"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
