// src/pages/student/tabs/StudentScheduleTab.jsx
// Student view of their teacher's week: free time + the student's own classes,
// all in the STUDENT's timezone. The teacher's timezone, country and email are
// intentionally never shown here.
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Globe, Lock } from "lucide-react";
import api from "../../../api";
import WeekCalendar, { Legend } from "../../../components/schedule/WeekCalendar";
import { getMonday, addDays, viewerTz, tzName, fmtDay, fmtRange } from "../../../utils/scheduleView";

function pal(dark) {
  return {
    card: dark ? "#1a1d2e" : "#ffffff", border: dark ? "#2a2d40" : "#ede9fe",
    heading: dark ? "#f0f4ff" : "#1e1b4b", text: dark ? "#c8cce0" : "#4b5563", muted: dark ? "#6b7090" : "#9ca3af",
  };
}

export default function StudentScheduleTab({ studentId, isDarkMode }) {
  const col = pal(isDarkMode);
  const myTz = viewerTz();
  const [teachers,  setTeachers]  = useState([]);
  const [teacher,   setTeacher]   = useState(null);
  const [weekStart, setWeekStart] = useState(() => getMonday());
  const [cal,       setCal]       = useState({ free: [], blocks: [], hasHours: false });
  const [loading,   setLoading]   = useState(false);
  const [detail,    setDetail]    = useState(null);

  // Teachers: direct assignments + anyone the student has a class with
  useEffect(() => {
    if (!studentId) return;
    Promise.allSettled([
      api.get("/teacher-assignments/my-teachers"),
      api.get(`/bookings/student/${studentId}?status=accepted`),
    ]).then(([assignRes, bookRes]) => {
      const map = new Map();
      if (assignRes.status === "fulfilled") (assignRes.value.data?.teachers || []).forEach(t => {
        if (t && !map.has(String(t._id))) map.set(String(t._id), { _id: t._id, firstName: t.firstName || "Teacher", lastName: t.lastName || "", photo: t.photo, displayName: t.displayName });
      });
      if (bookRes.status === "fulfilled") (bookRes.value.data || []).forEach(b => {
        const t = b.teacherId;
        if (t && !map.has(String(t._id || t))) map.set(String(t._id || t), { _id: t._id || t, firstName: t.firstName || "Teacher", lastName: t.lastName || "" });
      });
      const list = [...map.values()];
      setTeachers(list);
      if (list.length === 1) setTeacher(list[0]);
    });
  }, [studentId]);

  useEffect(() => {
    if (!teacher?._id) return;
    let stale = false;
    setLoading(true);
    api.get(`/teacher-availability/${teacher._id}/calendar`, { params: { from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() } })
      .then(({ data }) => { if (!stale) setCal(data); })
      .catch(() => {})
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [teacher, weekStart]);

  const items = useMemo(() => (cal.blocks || []).map(b => ({
    ...b,
    kind: b.mine ? b.kind : "busy",
    title: b.mine ? (b.kind === "pending" ? "Your request" : "Your class") : "Unavailable",
    sub: b.mine ? b.title : "",
    onClick: b.mine ? () => setDetail(b) : undefined,
  })), [cal.blocks]);

  const teacherName = (t) => t.displayName?.trim() || `${t.firstName} ${t.lastName}`.trim();

  if (!teacher) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: col.heading }}>Your teachers' schedules</h2>
        {teachers.length === 0 ? (
          <p style={{ color: col.muted, fontWeight: 700 }}>You don't have a teacher yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            {teachers.map(t => (
              <button key={t._id} type="button" onClick={() => setTeacher(t)}
                style={{ textAlign: "left", padding: 16, borderRadius: 16, border: `2px solid ${col.border}`, background: col.card, cursor: "pointer", fontFamily: "inherit", color: col.heading, fontWeight: 800 }}>
                {teacherName(t)}<div style={{ fontSize: 12, color: col.muted, fontWeight: 600, marginTop: 4 }}>See free times →</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {teachers.length > 1 && (
          <button type="button" onClick={() => setTeacher(null)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1px solid ${col.border}`, background: "transparent", color: col.heading, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <ChevronLeft size={14} /> Back
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", color: "#fff", fontWeight: 800 }}>
            {teacher.photo ? <img src={teacher.photo} alt="" style={{ width: 40, height: 40, objectFit: "cover" }} /> : teacherName(teacher)[0]}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: col.heading }}>{teacherName(teacher)}</div>
            <div style={{ fontSize: 12, color: col.muted, display: "flex", alignItems: "center", gap: 4 }}><Globe size={11} /> Times are in your time: {tzName(myTz)}</div>
          </div>
        </div>
      </div>

      {cal.hidden ? (
        <div style={{ padding: 28, borderRadius: 16, border: `2px solid ${col.border}`, background: col.card, textAlign: "center", color: col.text }}>
          <Lock size={28} style={{ opacity: 0.5 }} />
          <p style={{ fontWeight: 800, margin: "8px 0 0" }}>Your teacher's schedule is private.</p>
        </div>
      ) : (
        <>
          {!cal.hasHours && <p style={{ margin: 0, fontSize: 13, color: col.text }}>Your teacher hasn't set working hours yet, so free time isn't shown — you can still request any time from <strong>Book a Class</strong>.</p>}
          <Legend kinds={cal.hasHours ? ["free", "booked", "pending", "busy"] : ["booked", "pending", "busy"]} isDarkMode={isDarkMode} />
          <WeekCalendar weekStart={weekStart} onWeekChange={(w) => setWeekStart(w || getMonday())}
            free={cal.free} items={items} loading={loading} isDarkMode={isDarkMode} emptyText={cal.hasHours ? "No free time" : "Nothing booked"} />
        </>
      )}

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" style={{ background: col.card, borderRadius: 18, padding: 20, width: "100%", maxWidth: 380, border: `1px solid ${col.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: col.muted }}>{detail.kind === "pending" ? "Waiting for teacher" : "Your class"}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: col.heading, margin: "4px 0 8px" }}>{detail.title}</div>
            <div style={{ fontSize: 14, color: col.heading }}>{fmtDay(detail.start)} · <strong>{fmtRange(detail.start, detail.end)}</strong></div>
            {detail.topic && <div style={{ fontSize: 13, color: col.text, marginTop: 6 }}>Topic: {detail.topic}</div>}
            <button type="button" onClick={() => setDetail(null)} style={{ marginTop: 14, width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${col.border}`, background: "transparent", color: col.heading, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
