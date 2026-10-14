// src/pages/admin/tabs/ClassesTab.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Video, ExternalLink, RefreshCw, Radio, Clock, BookOpen,
  AlertCircle, Monitor, Calendar, Loader2, X, Wifi, WifiOff,
  CheckCircle2,
} from "lucide-react";
import { getAllBookings } from "../../../services/bookingService";
import api from "../../../api";
import { useOnDataChanged, useLiveEvent } from "../../../hooks/useLiveData";
import { useTranslation } from "react-i18next";
import { dateLocale } from "../../../i18n/dateLocale.js";

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
  new Date(iso).toLocaleString(dateLocale("en-GB"), {
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
  const { t: tr } = useTranslation("admin");
  if (!session) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full
          ${dm ? "bg-stone-800 text-stone-500" : "bg-stone-100 text-stone-400"}`}>
          <WifiOff size={11} /> {tr("classesTab.classroomNotOpenedYet")}
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

    const colorAbsent   = dm ? "bg-stone-800 text-stone-500" : "bg-stone-100 text-stone-400";
    const colorUncertain = dm ? "bg-amber-900/40 text-amber-300 border border-amber-800/40"
                              : "bg-amber-100 text-amber-700 border border-amber-200";

    return (
      <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium
        ${present ? (uncertain ? colorUncertain : colorPresent) : colorAbsent}`}>
        {present ? <Wifi size={11} /> : <WifiOff size={11} />}
        {label} {present ? (uncertain ? "joined" : "active") : tr("classesTab.notJoined")}
      </span>
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {badge("teacher", teacherStatus)}
      {badge("student", studentStatus)}
      {both && (
        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium
          ${dm ? "bg-ad-accent-soft text-ad-accent-ink border border-ad-accent-line"
               : "bg-ad-accent-soft text-ad-accent-ink border border-ad-accent-line"}`}>
          <CheckCircle2 size={11} /> {tr("classesTab.bothInClass")}
        </span>
      )}
    </div>
  );
}

// ── Live countdown bar ────────────────────────────────────────────────────────
function LiveTimer({ booking }) {
  const { t: tr } = useTranslation("admin");
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
        <span className="text-stone-400">{tr("classesTab.elapsed", { fmtTime: fmtTime(elapsed) })}</span>
        <span className={`font-medium ${remaining < 300 ? "text-red-400" : "text-stone-400"}`}>
          {tr("classesTab.left", { fmtTime: fmtTime(remaining) })}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-stone-700/30 overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-300 ease-out ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Platform label helpers ────────────────────────────────────────────────────
const PLATFORM_LABEL = { zoom: "Zoom", googlemeet: "Google Meet", agora: "Agora" };
const PLATFORM_COLOR = {
  zoom:       { bg: dm => dm ? "bg-blue-900/40 text-blue-300 border-blue-800/40"       : "bg-blue-100 text-blue-700 border-blue-200" },
  googlemeet: { bg: dm => dm ? "bg-emerald-900/40 text-emerald-300 border-emerald-800/40" : "bg-emerald-100 text-emerald-700 border-emerald-200" },
  agora:      { bg: dm => dm ? "bg-ad-accent-soft text-ad-accent-ink border-ad-accent-line"   : "bg-ad-accent-soft text-ad-accent-ink border-ad-accent-line" },
};

// ── Single live class card ────────────────────────────────────────────────────
function LiveClassCard({ booking, session, onJoinAgora, onJoinMeet, dm }) {
  const { t: tr } = useTranslation("admin");
  const teacherName    = `${booking.teacherId?.firstName ?? ""} ${booking.teacherId?.lastName ?? ""}`.trim() || "—";
  const studentName    = `${booking.studentId?.firstName ?? ""} ${booking.studentId?.lastName ?? ""}`.trim() || "—";
  const meetLink       = booking.teacherId?.googleMeetLink;
  const zoomLink       = booking.teacherId?.zoomLink;
  const activeProvider = session?.videoProvider; // 'zoom' | 'googlemeet' | 'agora' | undefined

  const teacherStatus = getPresenceStatus(session, "teacher");
  const studentStatus = getPresenceStatus(session, "student");
  const teacherIn = teacherStatus !== "not_joined";
  const studentIn = studentStatus !== "not_joined";
  const both      = teacherIn && studentIn;

  // Whether each platform button should be highlighted as the active one
  const zoomActive = activeProvider === "zoom";
  const meetActive = activeProvider === "googlemeet";
  const agoraActive = activeProvider === "agora";

  return (
    <div className={`rounded-xl border overflow-hidden flex flex-col ${dm ? "bg-[var(--a-surface)] border-[var(--a-line)]" : "bg-white border-stone-200"}`}>
      {/* Card header */}
      <div className={`px-5 py-3 border-b flex items-center justify-between ${dm ? "bg-[var(--a-surface)] border-[var(--a-line)]" : "bg-stone-50 border-stone-100"}`}>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs font-bold text-red-500 uppercase tracking-widest">{tr("classesTab.live")}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${both
              ? dm ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-100 text-emerald-700"
              : session
              ? dm ? "bg-amber-900/40 text-amber-300"     : "bg-amber-100 text-amber-700"
              : dm ? "bg-stone-800 text-stone-500"        : "bg-stone-100 text-stone-500"}`}>
            {both ? tr("classesTab.bothPresent") : session ? tr("classesTab.waiting") : tr("classesTab.notOpened")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Active platform badge */}
          {activeProvider && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border
              ${PLATFORM_COLOR[activeProvider]?.bg(dm) ?? ""}`}>
              {PLATFORM_LABEL[activeProvider]}
            </span>
          )}
          <span className={`text-xs ${dm ? "text-stone-500" : "text-stone-400"}`}>{tr("classesTab.min", { duration: booking.duration })}</span>
        </div>
      </div>

      <div className="p-5 space-y-4 flex-1">
        {/* Title */}
        <div>
          <h3 className="font-bold text-base leading-snug">{booking.classTitle}</h3>
          {booking.topic && (
            <p className={`text-xs mt-0.5 ${dm ? "text-stone-400" : "text-stone-500"}`}>{booking.topic}</p>
          )}
        </div>

        {/* People */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: tr("classesTab.teacher"), name: teacherName,
              bg: dm ? "bg-ad-accent-soft text-ad-accent-ink" : "bg-ad-accent-soft text-ad-accent-ink" },
            { label: tr("classesTab.student"), name: studentName,
              bg: dm ? "bg-emerald-900/50 text-emerald-300" : "bg-emerald-100 text-emerald-600" },
          ].map(({ label, name, bg }) => (
            <div key={label} className={`rounded-lg p-3 ${dm ? "bg-[var(--a-surface)]" : "bg-stone-50"}`}>
              <div className={`text-xs mb-1 ${dm ? "text-stone-500" : "text-stone-400"}`}>{label}</div>
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

      {/* Join buttons */}
      <div className="px-5 pb-5 pt-2 flex flex-col gap-2">

        {/* Zoom row — show whenever teacher has a Zoom link OR is actively using Zoom */}
        {(zoomLink || zoomActive) && (
          <button
            onClick={() => zoomLink
              ? window.open(zoomLink, "_blank", "noopener,noreferrer")
              : undefined
            }
            disabled={!zoomLink}
            title={!zoomLink ? tr("classesTab.teacherIsOnZoomBut") : tr("classesTab.joinZoomMeeting")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition
              ${zoomLink
                ? "bg-[#2D8CFF] hover:bg-[#1a7de8] cursor-pointer"
                : dm ? "bg-stone-700 text-stone-400 cursor-not-allowed" : "bg-stone-200 text-stone-400 cursor-not-allowed"}
              ${zoomActive ? "ring-2 ring-offset-1 ring-[#2D8CFF]" : ""}`}
          >
            <ExternalLink size={14} />
            {zoomActive ? tr("classesTab.joinZoomActive") : tr("classesTab.joinZoom")}
            {!zoomLink && <span className="text-xs opacity-75 ml-1">{tr("classesTab.noLinkSaved")}</span>}
          </button>
        )}

        {/* Meet row */}
        {meetLink && (
          <button
            onClick={() => onJoinMeet(meetLink)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition
              ${meetActive ? "ring-2 ring-offset-1 ring-emerald-400" : ""}`}
          >
            <ExternalLink size={14} />
            {meetActive ? tr("classesTab.joinMeetActive") : tr("classesTab.joinMeet")}
          </button>
        )}

        {/* Agora spectate row */}
        <button
          onClick={() => onJoinAgora(booking)}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ad-accent hover:bg-ad-accent-hover text-white text-sm font-semibold transition
            ${agoraActive ? "ring-2 ring-offset-1 ring-ad-accent" : ""}`}
        >
          <Video size={14} />
          {agoraActive ? tr("classesTab.joinAgoraActive") : tr("classesTab.spectateViaAgora")}
        </button>

        {/* Fallback when no external links and provider not yet chosen */}
        {!zoomLink && !meetLink && !zoomActive && !meetActive && !activeProvider && (
          <p className={`text-center text-xs mt-1 ${dm ? "text-stone-500" : "text-stone-400"}`}>
            {tr("classesTab.noMeetZoomLinkSet")}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Upcoming row ──────────────────────────────────────────────────────────────
function UpcomingRow({ booking, dm }) {
  const { t: tr } = useTranslation("admin");
  const teacherName = `${booking.teacherId?.firstName ?? ""} ${booking.teacherId?.lastName ?? ""}`.trim() || "—";
  const studentName = `${booking.studentId?.firstName ?? ""} ${booking.studentId?.lastName ?? ""}`.trim() || "—";
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
      ${dm ? "border-[var(--a-line)] hover:bg-[var(--a-raised)]" : "border-stone-100 hover:bg-stone-50"}`}>
      <div className={`p-2 rounded-lg flex-shrink-0 ${dm ? "bg-ad-accent-soft text-ad-accent-ink" : "bg-ad-accent-soft text-ad-accent-ink"}`}>
        <BookOpen size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{booking.classTitle}</div>
        <div className={`text-xs mt-0.5 ${dm ? "text-stone-400" : "text-stone-500"}`}>
          {teacherName} → {studentName}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-xs font-semibold ${dm ? "text-sky-400" : "text-sky-600"}`}>{tr("classesTab.in", { countdown })}</div>
        <div className={`text-xs ${dm ? "text-stone-500" : "text-stone-400"}`}>{fmtDate(booking.scheduledTime)}</div>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${dm ? "bg-stone-800 text-stone-400" : "bg-stone-100 text-stone-500"}`}>
        {booking.duration}m
      </span>
    </div>
  );
}

// ── Agora spectator modal (subscribe-only — admin cannot publish) ─────────────
const SPECTATE_LIMIT = 300; // 5 minutes

function AgoraModal({ booking, onClose, dm }) {
  const { t: tr } = useTranslation("admin");
  const [phase,       setPhase]       = useState("connecting");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(SPECTATE_LIMIT);
  const clientRef = useRef(null);

  // 5-minute session limit — starts from mount
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { onClose(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [onClose]);

  const timerMm  = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const timerSs  = String(secondsLeft % 60).padStart(2, "0");
  const timerWarn = secondsLeft <= 60;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        AgoraRTC.setLogLevel(import.meta.env.DEV ? 0 : 3);
        if (!mounted) return;

        const { data } = await api.get(`/agora/token?channel=class-${booking._id}`);
        if (!data.success || !data.appId) throw new Error(data.message || "Could not get Agora token");
        if (!mounted) return;

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "audio") user.audioTrack?.play();
          if (mediaType === "video") {
            setRemoteUsers((prev) => {
              const entry = { uid: user.uid, videoTrack: user.videoTrack };
              return prev.find((u) => u.uid === user.uid)
                ? prev.map((u) => (u.uid === user.uid ? entry : u))
                : [...prev, entry];
            });
          }
        });
        client.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "audio") user.audioTrack?.stop();
          if (mediaType === "video") setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        });
        client.on("user-left", (user) =>
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid))
        );

        await client.join(data.appId, data.channel, data.token, null);
        if (!mounted) return;
        setPhase("connected");
      } catch (e) {
        if (mounted) { setPhase("error"); setErrorMsg(e.message); }
      }
    })();
    return () => { mounted = false; clientRef.current?.leave().catch(() => {}); };
  }, [booking._id]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-3 border-b flex-shrink-0
        ${dm ? "bg-[var(--a-surface)] border-[var(--a-line)]" : "bg-stone-900 border-stone-700"}`}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-white font-semibold text-sm">{tr("classesTab.monitoring", { classTitle: booking.classTitle })}
          </span>
          <span className="text-stone-400 text-xs">{tr("classesTab.spectatorOnly", { firstName: booking.teacherId?.firstName, firstName2: booking.studentId?.firstName })}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border
            ${timerWarn
              ? "bg-red-900/40 border-red-700/50 text-red-300 animate-pulse"
              : "bg-stone-800 border-stone-700 text-stone-300"}`}>
            ⏱ {timerMm}:{timerSs}
          </span>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-red-600 text-white text-sm transition"
          >
            <X size={14} /> {tr("classesTab.leave")}
          </button>
        </div>
      </div>
      {timerWarn && (
        <div className="bg-red-900/30 border-b border-red-800/40 px-5 py-1.5 text-center text-xs text-red-300 font-semibold">{tr("classesTab.sessionEndingInSSpectating", { secondsLeft })}</div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 overflow-auto">
        {phase === "connecting" && (
          <>
            <Loader2 size={36} className="text-ad-accent-ink animate-spin" />
            <p className="text-stone-300 text-sm">{tr("classesTab.joiningAsSpectator")}</p>
          </>
        )}
        {phase === "error" && (
          <>
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-red-400 font-semibold text-sm">{tr("classesTab.failedToConnect")}</p>
            <p className="text-stone-400 text-xs">{errorMsg}</p>
          </>
        )}
        {phase === "connected" && remoteUsers.length === 0 && (
          <>
            <Monitor size={36} className="text-stone-500" />
            <p className="text-stone-400 text-sm">{tr("classesTab.connectedWaitingForVideoFrom")}</p>
          </>
        )}
        {remoteUsers.length > 0 && (
          <div className="flex flex-wrap gap-4 w-full justify-center">
            {remoteUsers.map((u) => (
              <RemoteVideoTile key={u.uid} uid={u.uid} videoTrack={u.videoTrack} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RemoteVideoTile({ uid, videoTrack }) {
  const { t: tr } = useTranslation("admin");
  const ref = useRef(null);
  useEffect(() => {
    if (videoTrack && ref.current) {
      videoTrack.play(ref.current);
      return () => videoTrack.stop();
    }
  }, [videoTrack]);
  return (
    <div className="relative rounded-xl overflow-hidden bg-stone-900 border border-stone-700"
      style={{ width: "480px", maxWidth: "100%", aspectRatio: "16/9" }}>
      <div ref={ref} className="w-full h-full" />
      <span className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">{tr("classesTab.uid", { uid })}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ClassesTab({ isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const dm = isDarkMode;

  const [bookings,     setBookings]     = useState([]);
  const [acceptedTotal, setAcceptedTotal] = useState(0);
  const [sessions,     setSessions]     = useState({});
  const [loading,      setLoading]      = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [agoraBooking, setAgoraBooking] = useState(null);
  const [error,        setError]        = useState("");

  const bookingIntervalRef = useRef(null);
  const sessionIntervalRef = useRef(null);
  const liveIdsRef         = useRef([]);

  const th = {
    page:     dm ? "bg-[var(--a-bg)] text-stone-100"       : "bg-stone-50 text-stone-900",
    card:     dm ? "bg-[var(--a-surface)] border-[var(--a-line)]"     : "bg-white border-stone-200",
    cardHead: dm ? "bg-[var(--a-surface)] border-[var(--a-line)]"     : "bg-stone-50 border-stone-200",
    muted:    dm ? "text-stone-400"                    : "text-stone-500",
    divider:  dm ? "border-[var(--a-line)]"                  : "border-stone-200",
    statCard: dm ? "bg-[var(--a-surface)] border-[var(--a-line)]"     : "bg-white border-stone-200",
  };

  // ── fetch sessions for currently live bookings ───────────────────────────────
  const fetchSessions = useCallback(async (liveIds) => {
    if (!liveIds.length) return;
    const results = await Promise.allSettled(
      liveIds.map((id) => api.get(`/classroom/session/${id}`))
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
      // Live + upcoming accepted classes only (soonest first) — a plain "newest 100"
      // list put far-future bookings first and could push live classes out.
      const data = await getAllBookings({ active: 1 });
      const list = Array.isArray(data) ? data : (data.bookings || []);
      setBookings(list);
      setAcceptedTotal(data.acceptedTotal ?? list.length);
      setLastRefresh(new Date());

      const live = list.filter(isLiveNow);
      liveIdsRef.current = live.map((b) => b._id);
      await fetchSessions(liveIdsRef.current);
    } catch {
      setError(tr("classesTab.failedToLoadClassesPlease"));
    } finally {
      setLoading(false);
    }
  }, [fetchSessions, tr]);

  // ── Live updates (no polling) ───────────────────────────────────────────────
  // • The class list reloads when the server says bookings changed.
  // • Presence (who joined, heartbeats, provider) is pushed by the server as a
  //   tiny "class-presence" summary — no per-class requests from any admin.
  // • A 30s client-side clock moves classes into "Live now" on time (no API);
  //   a class that just went live gets its presence fetched once.
  // • 5-minute safety refresh, and a refresh on returning to the tab.
  useEffect(() => {
    fetchBookings();
    bookingIntervalRef.current = setInterval(fetchBookings, 5 * 60_000);
    return () => clearInterval(bookingIntervalRef.current);
  }, [fetchBookings]);
  useOnDataChanged(["bookings", "classes"], fetchBookings);

  useLiveEvent("class-presence", (p) => {
    setSessions((prev) => {
      const old = prev[p.bookingId] || {};
      const beats = (old.heartbeats || []).filter((h) => !["teacher", "student"].includes(h.userRole));
      if (p.lastBeat?.teacher) beats.push({ userRole: "teacher", timestamp: p.lastBeat.teacher });
      if (p.lastBeat?.student) beats.push({ userRole: "student", timestamp: p.lastBeat.student });
      return { ...prev, [p.bookingId]: { ...old, teacherJoinedAt: p.teacherJoinedAt, studentJoinedAt: p.studentJoinedAt,
        videoProvider: p.videoProvider, status: p.status, managedAttendance: p.managedAttendance, heartbeats: beats } };
    });
  });

  const [, setClock] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClock((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const liveClasses     = bookings.filter(isLiveNow);
  // A class that has just become live (by the clock) → fetch its presence once
  const liveKey = liveClasses.map((b) => b._id).join(",");
  useEffect(() => {
    const ids = liveKey ? liveKey.split(",") : [];
    liveIdsRef.current = ids;
    const missing = ids.filter((id) => !sessions[id]);
    if (missing.length) fetchSessions(missing);
  }, [liveKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcomingClasses = bookings
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${dm ? "text-stone-400" : "text-stone-500"}`}>
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-ad-accent-ink" />
          {tr("classesTab.loadingClasses")}
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
          <h2 className="text-2xl font-bold text-ad-accent-ink">{tr("classesTab.liveClasses")}</h2>
          <p className={`text-sm mt-1 ${th.muted}`}>{tr("classesTab.monitorAndJoinOngoingClasses")}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className={`text-xs ${th.muted}`}>{tr("classesTab.updated", { value: lastRefresh.toLocaleTimeString() })}</span>
          )}
          <button
            onClick={fetchBookings}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition
              ${dm ? "border-[var(--a-line)] text-stone-300 hover:bg-[var(--a-raised)]" : "border-stone-300 text-stone-600 hover:bg-stone-50"}`}
          >
            <RefreshCw size={14} />
            {tr("classesTab.refresh")}
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
          { icon: Radio,        label: tr("classesTab.liveNow"),            value: liveClasses.length,
            cls: dm ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600" },
          { icon: Calendar,     label: tr("classesTab.upcomingAccepted"), value: upcomingClasses.length,
            cls: dm ? "bg-sky-900/30 text-sky-400" : "bg-sky-100 text-sky-600" },
          { icon: CheckCircle2, label: tr("classesTab.totalAccepted"),      value: acceptedTotal,
            cls: dm ? "bg-ad-accent-soft text-ad-accent-ink" : "bg-ad-accent-soft text-ad-accent-ink" },
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
          <h3 className="font-bold text-base">{tr("classesTab.happeningNow")}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${dm ? "bg-red-900/40 text-red-300" : "bg-red-100 text-red-600"}`}>
            {tr("classesTab.active", { liveClassesCount: liveClasses.length })}</span>
          <span className={`text-xs ml-auto ${th.muted}`}>
            {tr("classesTab.sessionStatusUpdatesEvery4s")}
          </span>
        </div>

        {liveClasses.length === 0 ? (
          <div className={`rounded-xl border p-14 flex flex-col items-center gap-3 ${th.card}`}>
            <Monitor size={40} className={`opacity-25 ${th.muted}`} />
            <p className={`text-sm ${th.muted}`}>{tr("classesTab.noClassesAreLiveRight")}</p>
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
          <h3 className="font-bold text-base">{tr("classesTab.upcomingAcceptedClasses")}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${dm ? "bg-sky-900/40 text-sky-300" : "bg-sky-100 text-sky-700"}`}>
            {upcomingClasses.length}
          </span>
        </div>

        {upcomingClasses.length === 0 ? (
          <div className={`rounded-xl border p-10 flex flex-col items-center gap-3 ${th.card}`}>
            <Calendar size={36} className={`opacity-25 ${th.muted}`} />
            <p className={`text-sm ${th.muted}`}>{tr("classesTab.noUpcomingClassesScheduled")}</p>
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${th.card}`}>
            <div className={`px-5 py-3 border-b ${th.cardHead} ${th.divider}`}>
              <div className={`grid grid-cols-4 gap-4 text-xs font-medium uppercase tracking-wide ${th.muted}`}>
                <span>{tr("classesTab.class")}</span>
                <span>{tr("classesTab.teacherStudent")}</span>
                <span>{tr("classesTab.scheduled")}</span>
                <span>{tr("classesTab.startsIn")}</span>
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
          <strong>{tr("classesTab.monitoringMode")}</strong> {tr("classesTab.theActivePlatformBadgeShows")}
        </span>
      </div>
    </div>
  );
}
