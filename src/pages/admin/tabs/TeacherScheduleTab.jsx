// src/pages/admin/tabs/TeacherScheduleTab.jsx
// Admin view: pick a teacher → see their week (free time, classes, time off) in
// the ADMIN's own timezone, with the teacher's local time alongside.
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Globe, X, Repeat, Clock, Loader } from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import { tzAbbr, tzCity } from "../../../utils/timezone";
import WeekCalendar, { Legend } from "../../../components/schedule/WeekCalendar";
import ManagedBadge from "../../../components/ManagedBadge";
import { getMonday, addDays, viewerTz, tzName, tzDiffText, fmtDay, fmtRange, fmtTime, fmtHHMM, localYmd, WEEKDAYS_SUN0 } from "../../../utils/scheduleView";

const CONTINENTS = ["Africa", "Europe", "Asia", "Americas", "Oceania"];
const HALF_HOURS = Array.from({ length: 49 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

// ── Palette ────────────────────────────────────────────────────────────────
function pal(dark) {
  return {
    bg:      dark ? "#0f1117" : "#f4f6fb",
    card:    dark ? "#1a1d27" : "#ffffff",
    border:  dark ? "#1e2235" : "#e8ecf4",
    heading: dark ? "#e2e8f0" : "#1e293b",
    text:    dark ? "#94a3b8" : "#475569",
    muted:   dark ? "#4b5563" : "#94a3b8",
    line:    dark ? "#1e2235" : "#f1f5f9",
    input:   dark ? "#141620" : "#f8faff",
    hover:   dark ? "rgba(255,255,255,0.015)" : "rgba(99,102,241,0.03)",
  };
}

// ── Teacher picker card ────────────────────────────────────────────────────
function TeacherCard({ teacher, onClick, isDarkMode }) {
  const c = pal(isDarkMode);
  const displayName = teacher.displayName?.trim() || `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
  const initials = `${teacher.firstName?.[0] || ""}${teacher.lastName?.[0] || ""}`.toUpperCase();
  return (
    <div
      onClick={() => onClick(teacher)}
      style={{
        background: c.card, border: `1px solid ${c.border}`,
        borderRadius: "16px", padding: "20px",
        cursor: "pointer", transition: "all 0.18s",
        display: "flex", flexDirection: "column", gap: "12px",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = isDarkMode ? "0 8px 24px rgba(0,0,0,0.3)" : "0 8px 24px rgba(99,102,241,0.15)"; e.currentTarget.style.borderColor = "#7c3aed"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = c.border; }}
    >
      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: "#fff", fontWeight: "800", fontSize: "15px" }}>{initials}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: "800", fontSize: "14px", color: c.heading, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayName}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: c.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {teacher.email}
          </p>
        </div>
      </div>

      {/* Meta pills */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", background: isDarkMode ? "rgba(124,58,237,0.15)" : "#f5f3ff", color: "#7c3aed" }}>
          {teacher.continent || "—"}
        </span>
        {teacher.timezone && (
          <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: isDarkMode ? "rgba(14,165,233,0.12)" : "#f0f9ff", color: "#0284c7", display: "flex", alignItems: "center", gap: "4px" }}>
            <Globe size={9} /> {tzCity(teacher.timezone)} · {tzAbbr(teacher.timezone)}
          </span>
        )}
        <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: teacher.active ? (isDarkMode ? "rgba(16,185,129,0.12)" : "#f0fdf4") : (isDarkMode ? "rgba(239,68,68,0.1)" : "#fef2f2"), color: teacher.active ? "#059669" : "#dc2626" }}>
          {teacher.active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* View schedule button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
        <span style={{ fontSize: "12px", color: c.muted }}>{teacher.lessonsCompleted || 0} lessons done</span>
        <span style={{ fontSize: "12px", fontWeight: "700", color: "#7c3aed", display: "flex", alignItems: "center", gap: "4px" }}>
          View Schedule <ChevronRight size={13} />
        </span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function TeacherScheduleTab({ teachers = [], isDarkMode }) {
  const c = pal(isDarkMode);
  const myTz = viewerTz();
  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState(null);
  const [weekStart, setWeekStart] = useState(() => getMonday());
  const [cal,       setCal]       = useState({ free: [], blocks: [], hasHours: false, workingHours: [], timezone: "" });
  const [loading,   setLoading]   = useState(false);
  const [detail,    setDetail]    = useState(null);
  const [continent, setContinent] = useState("");

  // ── Free-time finder ("who is free Thu 1–2 PM?") — in the admin's own time ──
  const nextHour = () => { const d = new Date(Date.now() + 3600000); return `${String(d.getHours()).padStart(2, "0")}:00`; };
  const [fDate, setFDate] = useState(() => localYmd(new Date()));
  const [fFrom, setFFrom] = useState(nextHour);
  const [fTo,   setFTo]   = useState(() => { const h = Math.min(24, parseInt(nextHour(), 10) + 1); return `${String(h).padStart(2, "0")}:00`; });
  const [found, setFound] = useState(null);   // { available, partial, noHours, start, end }
  const [finding, setFinding] = useState(false);
  const [findErr, setFindErr] = useState("");
  const findFree = async () => {
    setFindErr("");
    if (fTo <= fFrom) { setFindErr("The end time must be after the start time."); return; }
    const start = new Date(`${fDate}T${fFrom}:00`);
    const end = fTo === "24:00" ? new Date(new Date(`${fDate}T00:00:00`).getTime() + 86400000) : new Date(`${fDate}T${fTo}:00`);
    setFinding(true);
    try {
      const { data } = await api.get("/teacher-availability/free-search", { params: { start: start.toISOString(), end: end.toISOString(), continent: continent || undefined } });
      setFound({ ...data, start, end });
    } catch (err) {
      setFindErr(err?.response?.data?.message || "Search failed");
    } finally { setFinding(false); }
  };
  const openFromSearch = (row) => {
    const t = teachers.find(x => String(x._id) === row._id) || { ...row, firstName: row.name, lastName: "" };
    setWeekStart(getMonday(found?.start || new Date()));
    setSelected(t);
  };

  const [reloadKey, setReloadKey] = useState(0);
  useOnDataChanged(["schedule", "bookings"], () => setReloadKey(k => k + 1)); // live
  useEffect(() => {
    if (!selected?._id) return;
    let stale = false;
    setLoading(true);
    api.get(`/teacher-availability/${selected._id}/calendar`, { params: { from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() } })
      .then(({ data }) => { if (!stale) setCal(data); })
      .catch(() => {})
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [selected, weekStart, reloadKey]);

  const items = useMemo(() => (cal.blocks || []).map(b => ({
    ...b,
    title: b.kind === "off" ? (b.note || "Time off") : b.kind === "reserved" ? `Reserved · ${b.studentName}` : b.title,
    sub: ["booked", "pending", "done"].includes(b.kind) ? b.studentName : "",
    onClick: () => setDetail(b),
  })), [cal.blocks]);

  const filtered = teachers.filter(t =>
    (!continent || t.continent === continent) &&
    `${t.displayName || ""} ${t.firstName} ${t.lastName} ${t.email}`.toLowerCase().includes(search.toLowerCase())
  );
  const inp = { padding: "9px 10px", borderRadius: "10px", border: `1.5px solid ${c.border}`, background: c.card, color: c.heading, fontSize: "13.5px", fontFamily: "inherit" };
  const resultRow = (r, extra) => (
    <button key={r._id} type="button" onClick={() => openFromSearch(r)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0, overflow: "hidden" }}>
        {r.photo ? <img src={r.photo} alt="" style={{ width: 36, height: 36, objectFit: "cover" }} /> : (r.name?.[0] || "T").toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: c.heading }}>{r.name} <span style={{ fontWeight: 600, fontSize: 12, color: c.muted }}>· {r.continent || "—"}</span></div>
        <div style={{ fontSize: 12, color: c.text }}>
          Their time: {found && fmtRange(found.start, found.end, r.timezone)} ({tzCity(r.timezone)})
          {extra}
        </div>
      </div>
      <ChevronRight size={16} color={c.muted} />
    </button>
  );

  // ═══════════════════════ TEACHER PICKER VIEW ═══════════════════════
  if (!selected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: "var(--font-body)" }}>
        <style>{`
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        `}</style>

        {/* Header */}
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: c.heading }}>Teacher Schedules</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: c.text }}>
            Select a teacher to view their availability and bookings
          </p>
        </div>

        {/* ── Free-time finder ── */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.heading, display: "flex", alignItems: "center", gap: 6 }}><Clock size={15} color="#7c3aed" /> Find a free teacher</div>
            <div style={{ fontSize: 12.5, color: c.text }}>Times are in your time ({tzName(myTz)}). Each teacher's own time is shown in the results.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: c.muted }}>DATE<br />
              <input type="date" value={fDate} min={localYmd(new Date())} onChange={e => setFDate(e.target.value)} style={inp} />
            </label>
            <label style={{ fontSize: 11, fontWeight: 700, color: c.muted }}>FROM<br />
              <select value={fFrom} onChange={e => setFFrom(e.target.value)} style={inp}>{HALF_HOURS.slice(0, -1).map(t => <option key={t} value={t}>{fmtHHMM(t)}</option>)}</select>
            </label>
            <label style={{ fontSize: 11, fontWeight: 700, color: c.muted }}>TO<br />
              <select value={fTo} onChange={e => setFTo(e.target.value)} style={{ ...inp, borderColor: fTo <= fFrom ? "#ef4444" : c.border }}>{HALF_HOURS.slice(1).map(t => <option key={t} value={t}>{fmtHHMM(t)}</option>)}</select>
            </label>
            <label style={{ fontSize: 11, fontWeight: 700, color: c.muted }}>CONTINENT<br />
              <select value={continent} onChange={e => setContinent(e.target.value)} style={inp}>
                <option value="">All continents</option>
                {CONTINENTS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <button type="button" onClick={findFree} disabled={finding}
              style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              {finding ? <Loader size={14} /> : <Search size={14} />} Find free teachers
            </button>
          </div>
          {findErr && <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>{findErr}</div>}
          {found && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: c.text }}>
                {fmtDay(found.start)} · <strong style={{ color: c.heading }}>{fmtRange(found.start, found.end)}</strong>{continent ? ` · ${continent}` : ""}
                <button type="button" onClick={() => setFound(null)} style={{ marginLeft: 10, background: "none", border: "none", color: c.muted, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Clear</button>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#059669", marginBottom: 6 }}>✓ FREE THE WHOLE TIME ({found.available.length})</div>
                {found.available.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 8 }}>{found.available.map(r => resultRow(r))}</div>
                  : <div style={{ fontSize: 13, color: c.muted }}>No teacher is free for the whole time.</div>}
              </div>
              {found.partial.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#d97706", marginBottom: 6 }}>◐ PARTLY FREE ({found.partial.length})</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 8 }}>
                    {found.partial.map(r => resultRow(r, <><br /><span style={{ color: "#d97706", fontWeight: 700 }}>Free {r.free.map(f => fmtRange(f.start, f.end)).join(", ")} (your time)</span></>))}
                  </div>
                </div>
              )}
              {found.noHours.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: c.muted, marginBottom: 6 }}>? NO WORKING HOURS SET — NOTHING BOOKED THEN ({found.noHours.length})</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 8 }}>{found.noHours.map(r => resultRow(r, <><br /><span style={{ color: c.muted }}>Ask the teacher to confirm</span></>))}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search + continent */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: "360px" }}>
          <Search size={15} color={c.muted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search teachers…"
            style={{
              width: "100%", padding: "10px 12px 10px 36px",
              background: c.card, border: `1.5px solid ${c.border}`,
              borderRadius: "12px", color: c.heading, fontSize: "13.5px",
              outline: "none", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>
          <select value={continent} onChange={e => setContinent(e.target.value)} aria-label="Filter by continent" style={inp}>
            <option value="">All continents</option>
            {CONTINENTS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>

        {/* Teacher grid */}
        {filtered.length === 0 ? (
          <p style={{ color: c.muted, fontSize: "13px" }}>No teachers found.</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "16px",
            animation: "fadeIn 0.2s ease",
          }}>
            {filtered.map(t => (
              <TeacherCard key={t._id} teacher={t} onClick={setSelected} isDarkMode={isDarkMode} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════ CALENDAR VIEW ═══════════════════════
  const initials = `${selected.firstName?.[0] || ""}${selected.lastName?.[0] || ""}`.toUpperCase();
  const selectedDisplayName = selected.displayName?.trim() || `${selected.firstName || ""} ${selected.lastName || ""}`.trim();
  const tTz = cal.timezone || selected.timezone || "";
  const freeMins = (cal.free || []).reduce((s, f) => s + (new Date(f.end) - new Date(f.start)) / 60000, 0);
  const count = (k) => (cal.blocks || []).filter(b => b.kind === k).length;
  const hoursText = (cal.workingHours || []).length
    ? [1, 2, 3, 4, 5, 6, 0].map(d => {
        const r = cal.workingHours.filter(x => x.day === d);
        return r.length ? `${WEEKDAYS_SUN0[d].slice(0, 3)} ${r.map(x => `${fmtHHMM(x.start)}–${fmtHHMM(x.end)}`).join(", ")}` : null;
      }).filter(Boolean).join(" · ")
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => { setSelected(null); setDetail(null); setCal({ free: [], blocks: [], hasHours: false }); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: isDarkMode ? "#1e2235" : "#f1f5f9", border: `1px solid ${c.border}`, borderRadius: "10px", cursor: "pointer", color: c.heading, fontSize: "13px", fontWeight: "700", fontFamily: "inherit" }}>
          <ChevronLeft size={15} /> All Teachers
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: "800", fontSize: "14px" }}>{initials}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: "800", fontSize: "16px", color: c.heading }}>{selectedDisplayName}</p>
            <p style={{ margin: 0, fontSize: "12px", color: c.muted }}>{selected.email}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["Free this week", cal.hasHours ? `${Math.round(freeMins / 6) / 10}h` : "—", "#059669"], ["Booked", count("booked"), "#7c3aed"], ["Pending", count("pending"), "#d97706"]].map(([l, v, col]) => (
            <span key={l} style={{ padding: "5px 12px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.card, fontSize: 12.5, color: c.text }}><strong style={{ color: col }}>{v}</strong> {l}</span>
          ))}
        </div>
      </div>

      {/* Whose clock is this? */}
      <div style={{ padding: "10px 14px", borderRadius: 12, background: c.card, border: `1px solid ${c.border}`, fontSize: 13, color: c.text, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Globe size={13} /> Shown in <strong style={{ color: c.heading }}>your time: {tzName(myTz)}</strong></span>
        {tTz && <span>Teacher: <strong style={{ color: c.heading }}>{tzName(tTz)}</strong> · {tzDiffText(tTz, myTz)}</span>}
        <span style={{ flexBasis: "100%", fontSize: 12.5 }}>
          {cal.hasHours ? <>Working hours ({tzCity(tTz)}): {hoursText}</> : "This teacher hasn't set working hours — students can request any time and the teacher approves."}
        </span>
      </div>

      <Legend kinds={["free", "booked", "pending", "off", "reserved"]} isDarkMode={isDarkMode} />
      <WeekCalendar weekStart={weekStart} onWeekChange={(w) => setWeekStart(w || getMonday())}
        free={cal.free} items={items} loading={loading} isDarkMode={isDarkMode} emptyText="Nothing scheduled" />

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" style={{ background: c.card, borderRadius: 18, padding: 20, width: "100%", maxWidth: 400, border: `1px solid ${c.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: c.muted }}>
                {{ booked: "Booked class", pending: "Pending request", done: "Completed class", off: "Time off", reserved: "Reserved" }[detail.kind]}
              </div>
              <button type="button" aria-label="Close" onClick={() => setDetail(null)} style={{ background: "none", border: "none", cursor: "pointer", color: c.muted }}><X size={16} /></button>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.heading }}>{detail.kind === "off" ? (detail.note || "Time off") : detail.title || detail.studentName}</div>
            <div style={{ fontSize: 14, color: c.heading }}>{fmtDay(detail.start)} · <strong>{fmtRange(detail.start, detail.end)}</strong> <span style={{ color: c.muted }}>your time</span></div>
            {tTz && tTz !== myTz && <div style={{ fontSize: 13, color: c.text }}>Teacher's time: <strong>{fmtDay(detail.start, tTz)} · {fmtRange(detail.start, detail.end, tTz)}</strong> ({tzAbbr(tTz)})</div>}
            {detail.studentTimezone && detail.studentTimezone !== myTz && <div style={{ fontSize: 13, color: c.text }}>Student's time: <strong>{fmtTime(detail.start, detail.studentTimezone)}</strong> ({tzName(detail.studentTimezone)})</div>}
            {detail.studentName && <div style={{ fontSize: 13.5, color: c.text, display: "flex", alignItems: "center", gap: 6 }}>Student: <strong style={{ color: c.heading }}>{detail.studentName}</strong> {detail.isManaged && <ManagedBadge isDarkMode={isDarkMode} />}</div>}
            {detail.topic && <div style={{ fontSize: 13, color: c.text }}>Topic: {detail.topic}</div>}
            {detail.recurring && <div style={{ fontSize: 12.5, color: c.muted, display: "flex", alignItems: "center", gap: 5 }}><Repeat size={12} /> Repeats every week</div>}
          </div>
        </div>
      )}
    </div>
  );
}
