// src/pages/admin/tabs/ClassesTab.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Video, ExternalLink, RefreshCw, Radio, Clock, BookOpen,
  AlertCircle, Monitor, Calendar, Loader2, X, Wifi, WifiOff,
  CheckCircle2,
} from "lucide-react";
import { getAllBookings } from "../../../services/bookingService";
import VideoCall from "../../VideoCall";
import api from "../../../api";

// ── helpers ──────────────────────────────────────────────────────────────────
const isLiveNow = (b) => {
  if (b.status !== "accepted") return false;
  const start = new Date(b.scheduledTime).getTime();
  const end   = start + (b.duration || 60) * 60 * 1000;
  const now   = Date.now();
  return now >= start && now <= end + 10 * 60 * 1000;
};

const isUpcoming = (b) => {
  if (b.status !== "accepted") return false;
  return new Date(b.scheduledTime).getTime() > Date.now();
};

const fmtTime = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// ── Presence helpers ──────────────────────────────────────────────────────────
// The Classroom component uses !!joinedAt (never checks leftAt) because
// teacherLeftAt gets set on page refresh/reconnect and is unreliable.
// We mirror that logic and additionally check heartbeat recency for accuracy.
// Heartbeats fire every 15 s → "active" = heartbeat within 90 s.
const lastHeartbeatAge = (session, role) => {
  const beats = (session?.heartbeats ?? [])
    .filter((h) => h.userRole === role)
    .map((h) => new Date(h.timestamp).getTime())
    .sort((a, b) => b - a);
  if (!beats.length) return Infinity;
  return Date.now() - beats[0];
};

// Returns: "active" | "joined" | "not_joined"
const getPresenceStatus = (session, role) => {
  if (!session) return "not_joined";
  const joinedKey = role === "teacher" ? "teacherJoinedAt" : "studentJoinedAt";
  if (!session[joinedKey]) return "not_joined";
  // Recent heartbeat (≤ 90 s) → definitely active
  if (lastHeartbeatAge(session, role) <= 90_000) return "active";
  // Joined but no recent heartbeat → class may have just started / reconnecting
  return "joined";
};

function PresenceBadge({ session, dm }) {
  if (!session) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full
          ${dm ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"}`}>
          <WifiOff size={11} /> Classroom not opened yet
        </span>
      </div>
    );
  }

  const teacherStatus = getPresenceStatus(session, "teacher");
  const studentStatus = getPresenceStatus(session, "student");
  const both = teacherStatus !== "not_joined" && studentStatus !== "not_joined";

  const badge = (role, status) => {
    const isTeacher   = role === "teacher";
    const label       = isTeacher ? "Teacher" : "Student";
    const present     = status !== "not_joined";
    const uncertain   = status === "joined"; // joined but heartbeat stale

    const colorPresent = isTeacher
      ? dm ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800/40"
           : "bg-emerald-100 text-emerald-700 border border-emerald-200"
      : dm ? "bg-sky-900/40 text-sky-300 border border-sky-800/40"
           : "bg-sky-100 text-sky-700 border border-sky-200";

    const colorAbsent   = dm ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400";
    const colorUncertain = dm ? "bg-amber-900/40 text-amber-300 border border-amber-800/40"
                              : "bg-amber-100 text-amber-700 border border-amber-200";

    return (
      <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium
        ${present ? (uncertain ? colorUncertain : colorPresent) : colorAbsent}`}>
        {present ? <Wifi size={11} /> : <WifiOff size={11} />}
        {label} {present ? (uncertain ? "joined" : "active") : "not joined"}
      </span>
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {badge("teacher", teacherStatus)}
      {badge("student", studentStatus)}
      {both && (
        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium
          ${dm ? "bg-violet-900/40 text-violet-300 border border-violet-800/40"
               : "bg-violet-100 text-violet-700 border border-violet-200"}`}>
          <CheckCircle2 size={11} /> Both in class
        </span>
      )}
    </div>
  );
}

// ── Live countdown bar ────────────────────────────────────────────────────────
function LiveTimer({ booking }) {
  const [elapsed, setElapsed] = useState(0);
  const dur = (booking.duration || 60) * 60;

  useEffect(() => {
    const start = new Date(booking.scheduledTime).getTime();
    const tick  = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [booking.scheduledTime]);

  const remaining = Math.max(0, dur - elapsed);
  const pct       = Math.min(100, (elapsed / dur) * 100);
  const barColor  = pct > 90 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">Elapsed {fmtTime(elapsed)}</span>
        <span className={`font-medium ${remaining < 300 ? "text-red-400" : "text-slate-400"}`}>
          {fmtTime(remaining)} left
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-700/30 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Single live class card ────────────────────────────────────────────────────
function LiveClassCard({ booking, session, onJoinAgora, onJoinMeet, dm }) {
  const teacherName = `${booking.teacherId?.firstName ?? ""} ${booking.teacherId?.lastName ?? ""}`.trim() || "—";
  const studentName = `${booking.studentId?.firstName ?? ""} ${booking.studentId?.surname ?? ""}`.trim() || "—";
  const meetLink    = booking.teacherId?.googleMeetLink;

  const teacherStatus = getPresenceStatus(session, "teacher");
  const studentStatus = getPresenceStatus(session, "student");
  const teacherIn = teacherStatus !== "not_joined";
  const studentIn = studentStatus !== "not_joined";
  const both      = teacherIn && studentIn;

  return (
    <div className={`rounded-xl border overflow-hidden flex flex-col ${dm ? "bg-[#1a1d27] border-[#1e2235]" : "bg-white border-slate-200"}`}>
      {/* Card header */}
      <div className={`px-5 py-3 border-b flex items-center justify-between ${dm ? "bg-[#13161f] border-[#1e2235]" : "bg-slate-50 border-slate-100"}`}>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Live</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${both
              ? dm ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-100 text-emerald-700"
              : session
              ? dm ? "bg-amber-900/40 text-amber-300"     : "bg-amber-100 text-amber-700"
              : dm ? "bg-slate-800 text-slate-500"        : "bg-slate-100 text-slate-500"}`}>
            {both ? "Both present" : session ? "Waiting…" : "Not opened"}
          </span>
        </div>
        <span className={`text-xs ${dm ? "text-slate-500" : "text-slate-400"}`}>{booking.duration} min</span>
      </div>

      <div className="p-5 space-y-4 flex-1">
        {/* Title */}
        <div>
          <h3 className="font-bold text-base leading-snug">{booking.classTitle}</h3>
          {booking.topic && (
            <p className={`text-xs mt-0.5 ${dm ? "text-slate-400" : "text-slate-500"}`}>{booking.topic}</p>
          )}
        </div>

        {/* People */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Teacher", name: teacherName,
              bg: dm ? "bg-violet-900/50 text-violet-300" : "bg-violet-100 text-violet-600" },
            { label: "Student", name: studentName,
              bg: dm ? "bg-emerald-900/50 text-emerald-300" : "bg-emerald-100 text-emerald-600" },
          ].map(({ label, name, bg }) => (
            <div key={label} className={`rounded-lg p-3 ${dm ? "bg-[#13161f]" : "bg-slate-50"}`}>
              <div className={`text-xs mb-1 ${dm ? "text-slate-500" : "text-slate-400"}`}>{label}</div>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${bg}`}>
                  {name[0]?.toUpperCase()}
                </div>
                <span className="text-xs font-medium truncate">{name}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Presence */}
        <PresenceBadge session={session} dm={dm} />

        {/* Timer */}
        <LiveTimer booking={booking} />
      </div>

      {/* Join buttons — always render both */}
      <div className={`px-5 pb-5 pt-2 grid gap-2 ${meetLink ? "grid-cols-2" : "grid-cols-1"}`}>
        {meetLink && (
          <button
            onClick={() => onJoinMeet(meetLink)}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition"
          >
            <ExternalLink size={14} />
            Google Meet
          </button>
        )}
        {!meetLink && (
          <div className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-medium
            ${dm ? "border-[#2a2f45] text-slate-500" : "border-slate-200 text-slate-400"}`}>
            <ExternalLink size={13} />
            No Meet link set
          </div>
        )}
        <button
          onClick={() => onJoinAgora(booking)}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition"
        >
          <Video size={14} />
          Join via Agora
        </button>
      </div>
    </div>
  );
}

// ── Upcoming row ──────────────────────────────────────────────────────────────
function UpcomingRow({ booking, dm }) {
  const teacherName = `${booking.teacherId?.firstName ?? ""} ${booking.teacherId?.lastName ?? ""}`.trim() || "—";
  const studentName = `${booking.studentId?.firstName ?? ""} ${booking.studentId?.surname ?? ""}`.trim() || "—";
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(booking.scheduledTime).getTime() - Date.now();
      if (diff <= 0) { setCountdown("Starting…"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [booking.scheduledTime]);

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 border-b last:border-b-0 transition
      ${dm ? "border-[#1e2235] hover:bg-[#1e2235]" : "border-slate-100 hover:bg-slate-50"}`}>
      <div className={`p-2 rounded-lg flex-shrink-0 ${dm ? "bg-violet-900/30 text-violet-400" : "bg-violet-100 text-violet-600"}`}>
        <BookOpen size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{booking.classTitle}</div>
        <div className={`text-xs mt-0.5 ${dm ? "text-slate-400" : "text-slate-500"}`}>
          {teacherName} → {studentName}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-xs font-semibold ${dm ? "text-sky-400" : "text-sky-600"}`}>in {countdown}</div>
        <div className={`text-xs ${dm ? "text-slate-500" : "text-slate-400"}`}>{fmtDate(booking.scheduledTime)}</div>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${dm ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
        {booking.duration}m
      </span>
    </div>
  );
}

// ── Agora monitor modal ───────────────────────────────────────────────────────
function AgoraModal({ booking, onClose, dm }) {
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  const adminId   = adminInfo._id || `admin_${Date.now()}`;
  const adminName = adminInfo.email ? `Admin (${adminInfo.email})` : "Admin";

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      <div className={`flex items-center justify-between px-5 py-3 border-b flex-shrink-0
        ${dm ? "bg-[#13161f] border-[#1e2235]" : "bg-slate-900 border-slate-700"}`}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-white font-semibold text-sm">
            Monitoring: {booking.classTitle}
          </span>
          <span className="text-slate-400 text-xs">
            ({booking.teacherId?.firstName} → {booking.studentId?.firstName})
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-red-600 text-white text-sm transition"
        >
          <X size={14} /> Leave
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <VideoCall
          channelName={booking._id}
          userId={adminId}
          userName={adminName}
          onLeave={onClose}
          mode="video"
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ClassesTab({ isDarkMode }) {
  const dm = isDarkMode;

  const [bookings,     setBookings]     = useState([]);
  const [sessions,     setSessions]     = useState({});
  const [loading,      setLoading]      = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [agoraBooking, setAgoraBooking] = useState(null);
  const [error,        setError]        = useState("");

  const bookingIntervalRef = useRef(null);
  const sessionIntervalRef = useRef(null);
  const liveIdsRef         = useRef([]);

  const th = {
    page:     dm ? "bg-[#0f1117] text-slate-100"       : "bg-slate-50 text-slate-900",
    card:     dm ? "bg-[#1a1d27] border-[#1e2235]"     : "bg-white border-slate-200",
    cardHead: dm ? "bg-[#13161f] border-[#1e2235]"     : "bg-slate-50 border-slate-200",
    muted:    dm ? "text-slate-400"                    : "text-slate-500",
    divider:  dm ? "border-[#1e2235]"                  : "border-slate-200",
    statCard: dm ? "bg-[#13161f] border-[#1e2235]"     : "bg-white border-slate-200",
  };

  // ── fetch sessions for currently live bookings ───────────────────────────────
  const fetchSessions = useCallback(async (liveIds) => {
    if (!liveIds.length) return;
    const results = await Promise.allSettled(
      liveIds.map((id) => api.get(`/api/classroom/session/${id}`))
    );
    setSessions((prev) => {
      const next = { ...prev };
      liveIds.forEach((id, i) => {
        const r = results[i];
        if (r.status === "fulfilled") {
          next[id] = r.value.data.session;
        }
        // If 404 (no session yet), leave as undefined — PresenceBadge handles it
      });
      return next;
    });
  }, []);

  // ── fetch all bookings ───────────────────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    setError("");
    try {
      const data = await getAllBookings();
      const list = Array.isArray(data) ? data : (data.bookings || []);
      setBookings(list);
      setLastRefresh(new Date());

      const live = list.filter(isLiveNow);
      liveIdsRef.current = live.map((b) => b._id);
      await fetchSessions(liveIdsRef.current);
    } catch {
      setError("Failed to load classes. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [fetchSessions]);

  // ── on mount: start two independent intervals ────────────────────────────────
  // Bookings: every 30s (heavier query)
  // Sessions: every 4s  (lightweight, only for live class IDs)
  useEffect(() => {
    fetchBookings();

    bookingIntervalRef.current = setInterval(fetchBookings, 30_000);

    sessionIntervalRef.current = setInterval(() => {
      if (liveIdsRef.current.length > 0) {
        fetchSessions(liveIdsRef.current);
      }
    }, 4_000);

    return () => {
      clearInterval(bookingIntervalRef.current);
      clearInterval(sessionIntervalRef.current);
    };
  }, [fetchBookings, fetchSessions]);

  const liveClasses     = bookings.filter(isLiveNow);
  const upcomingClasses = bookings
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${dm ? "text-slate-400" : "text-slate-500"}`}>
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-violet-500" />
          Loading classes…
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full p-6 ${th.page}`}>

      {/* ── Agora modal ────────────────────────────────────────────────────── */}
      {agoraBooking && (
        <AgoraModal booking={agoraBooking} onClose={() => setAgoraBooking(null)} dm={dm} />
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-violet-500">Live Classes</h2>
          <p className={`text-sm mt-1 ${th.muted}`}>Monitor and join ongoing classes in real time.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className={`text-xs ${th.muted}`}>Updated {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button
            onClick={fetchBookings}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition
              ${dm ? "border-[#2a2f45] text-slate-300 hover:bg-[#1e2235]" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Radio,        label: "Live Now",            value: liveClasses.length,
            cls: dm ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600" },
          { icon: Calendar,     label: "Upcoming (Accepted)", value: upcomingClasses.length,
            cls: dm ? "bg-sky-900/30 text-sky-400" : "bg-sky-100 text-sky-600" },
          { icon: CheckCircle2, label: "Total Accepted",      value: bookings.filter(b => b.status === "accepted").length,
            cls: dm ? "bg-violet-900/30 text-violet-400" : "bg-violet-100 text-violet-600" },
        ].map(({ icon: Icon, label, value, cls }) => (
          <div key={label} className={`rounded-xl border p-4 flex items-center gap-4 ${th.statCard}`}>
            <div className={`p-2.5 rounded-lg ${cls}`}><Icon size={18} /></div>
            <div>
              <div className="text-2xl font-bold leading-tight">{value}</div>
              <div className={`text-xs ${th.muted}`}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── LIVE CLASSES ──────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <h3 className="font-bold text-base">Happening Now</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${dm ? "bg-red-900/40 text-red-300" : "bg-red-100 text-red-600"}`}>
            {liveClasses.length} active
          </span>
          <span className={`text-xs ml-auto ${th.muted}`}>
            Session status updates every 4s
          </span>
        </div>

        {liveClasses.length === 0 ? (
          <div className={`rounded-xl border p-14 flex flex-col items-center gap-3 ${th.card}`}>
            <Monitor size={40} className={`opacity-25 ${th.muted}`} />
            <p className={`text-sm ${th.muted}`}>No classes are live right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {liveClasses.map((b) => (
              <LiveClassCard
                key={b._id}
                booking={b}
                session={sessions[b._id]}
                onJoinAgora={setAgoraBooking}
                onJoinMeet={(link) => window.open(link, "_blank", "noopener,noreferrer")}
                dm={dm}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── UPCOMING ──────────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Clock size={16} className={th.muted} />
          <h3 className="font-bold text-base">Upcoming Accepted Classes</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${dm ? "bg-sky-900/40 text-sky-300" : "bg-sky-100 text-sky-700"}`}>
            {upcomingClasses.length}
          </span>
        </div>

        {upcomingClasses.length === 0 ? (
          <div className={`rounded-xl border p-10 flex flex-col items-center gap-3 ${th.card}`}>
            <Calendar size={36} className={`opacity-25 ${th.muted}`} />
            <p className={`text-sm ${th.muted}`}>No upcoming classes scheduled.</p>
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${th.card}`}>
            <div className={`px-5 py-3 border-b ${th.cardHead} ${th.divider}`}>
              <div className={`grid grid-cols-4 gap-4 text-xs font-medium uppercase tracking-wide ${th.muted}`}>
                <span>Class</span>
                <span>Teacher → Student</span>
                <span>Scheduled</span>
                <span>Starts in</span>
              </div>
            </div>
            {upcomingClasses.map((b) => (
              <UpcomingRow key={b._id} booking={b} dm={dm} />
            ))}
          </div>
        )}
      </section>

      {/* ── Info note ─────────────────────────────────────────────────────────── */}
      <div className={`mt-6 flex items-start gap-3 text-xs px-4 py-3 rounded-xl border
        ${dm ? "bg-blue-900/20 border-blue-800/30 text-blue-300" : "bg-blue-50 border-blue-100 text-blue-700"}`}>
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <span>
          <strong>Monitoring mode:</strong> Joining via Agora makes you visible to the teacher and student.
          Google Meet uses the teacher's personal link — the teacher must have a Meet link configured in their profile.
        </span>
      </div>
    </div>
  );
}
