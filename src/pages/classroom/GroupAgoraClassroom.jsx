// GroupAgoraClassroom.jsx — Agora "live" mode group class
// Teacher = host (publishes audio + video)
// Students = audience by default; promoted students switch to host role to speak
import React, { useState, useEffect, useRef, useCallback } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { io } from "socket.io-client";
import api from "../../api";
import { useDarkMode } from "../../hooks/useDarkMode";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Hand, Users, Crown, UserCheck, UserX,
  ChevronRight, ChevronLeft, Loader2,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ── Video tile for a single stream ───────────────────────────────────────────
function VideoTile({ videoTrack, audioTrack, isLocal, label, isTeacher, hasHand }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    videoTrack.play(containerRef.current);
    return () => { try { videoTrack.stop(); } catch (_) {} };
  }, [videoTrack]);

  useEffect(() => {
    if (!audioTrack || isLocal) return;
    audioTrack.play();
    return () => { try { audioTrack.stop(); } catch (_) {} };
  }, [audioTrack, isLocal]);

  return (
    <div style={{
      position: "relative", borderRadius: 16, overflow: "hidden",
      background: "#1a1a2e", border: "2px solid #2d2d50",
      aspectRatio: "16/9", minHeight: 120,
    }}>
      {videoTrack
        ? <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        : (
          <div style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg,#1e1b4b,#312e81)",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, color: "#fff",
            }}>
              {label?.[0]?.toUpperCase() || "?"}
            </div>
          </div>
        )
      }

      {/* Name label */}
      <div style={{
        position: "absolute", bottom: 8, left: 10,
        background: "rgba(0,0,0,0.65)", borderRadius: 8,
        padding: "3px 10px", fontSize: 12, color: "#fff",
        display: "flex", alignItems: "center", gap: 5,
      }}>
        {isTeacher && <Crown size={12} color="#fbbf24" />}
        {label}
        {isLocal && <span style={{ opacity: 0.7 }}>(You)</span>}
      </div>

      {/* Raised hand badge */}
      {hasHand && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "#f59e0b", borderRadius: "50%",
          width: 28, height: 28, display: "flex",
          alignItems: "center", justifyContent: "center",
          animation: "pulse 1s ease-in-out infinite",
        }}>
          ✋
        </div>
      )}
    </div>
  );
}

// ── Participant row in the side panel ─────────────────────────────────────────
function ParticipantRow({ p, isTeacher, canControl, hasHand, onPromote, onDemote, onKick }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 10px", borderRadius: 10,
      background: "rgba(255,255,255,0.04)",
      marginBottom: 4,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: isTeacher ? "linear-gradient(135deg,#f59e0b,#f97316)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, color: "#fff", fontWeight: 700, flexShrink: 0,
      }}>
        {p.userName?.[0]?.toUpperCase() || "?"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, truncate: true }}>
          {p.userName}
          {isTeacher && <Crown size={11} color="#fbbf24" style={{ marginLeft: 4, verticalAlign: "middle" }} />}
          {p.isPromoted && !isTeacher && <span style={{ marginLeft: 4, fontSize: 11, color: "#34d399" }}>speaking</span>}
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>{p.role}</div>
      </div>
      {hasHand && <span title="Hand raised" style={{ fontSize: 16 }}>✋</span>}
      {canControl && !isTeacher && (
        <div style={{ display: "flex", gap: 4 }}>
          {p.isPromoted
            ? (
              <button onClick={() => onDemote(p.userId)} title="Lower to audience"
                style={{ background: "#f59e0b", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#fff" }}>
                <UserX size={13} />
              </button>
            )
            : (
              <button onClick={() => onPromote(p.userId)} title="Allow to speak"
                style={{ background: "#10b981", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#fff" }}>
                <UserCheck size={13} />
              </button>
            )
          }
          <button onClick={() => onKick(p.userId)} title="Kick from class"
            style={{ background: "#ef4444", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#fff" }}>
            <UserX size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GroupAgoraClassroom({ classData, userRole, onLeave }) {
  const { isDarkMode: dm } = useDarkMode();
  const groupClassId = classData.id;
  const channelName  = `group-${groupClassId}`;

  const clientRef          = useRef(null);
  const socketRef          = useRef(null);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const myUserIdRef        = useRef(null);
  const joinedRef          = useRef(false);
  const destroyedRef       = useRef(false);
  const trackingStartedRef = useRef(false);

  const [joined,       setJoined]       = useState(false);
  const [micOn,        setMicOn]        = useState(true);
  const [camOn,        setCamOn]        = useState(userRole === "teacher");
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [remoteUsers,  setRemoteUsers]  = useState([]); // [{uid, audioTrack, videoTrack}]
  const [participants, setParticipants] = useState([]); // socket-tracked list
  const [handRaised,   setHandRaised]   = useState(new Set());
  const [showPanel,    setShowPanel]    = useState(true);
  const [elapsedSec,   setElapsedSec]   = useState(0);
  const [error,        setError]        = useState(null);
  const [myUid,        setMyUid]        = useState(null);
  const [myName,       setMyName]       = useState("Me");

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`;
  };

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  const doCleanup = useCallback(async (endClass = false) => {
    // End usage tracking for teacher before tearing down the channel
    if (userRole === "teacher" && trackingStartedRef.current) {
      trackingStartedRef.current = false;
      api.post('/agora-usage/end', { bookingId: groupClassId }).catch(() => {});
    }
    destroyedRef.current = true;
    try {
      if (socketRef.current) {
        if (endClass) socketRef.current.emit("group-end-class", { groupClassId });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      const audio = localAudioTrackRef.current;
      const video = localVideoTrackRef.current;
      if (audio) { try { audio.stop(); audio.close(); } catch (_) {} localAudioTrackRef.current = null; }
      if (video) { try { video.stop(); video.close(); } catch (_) {} localVideoTrackRef.current = null; }
      if (clientRef.current && joinedRef.current) {
        await clientRef.current.leave();
        joinedRef.current = false;
      }
    } catch (_) {}
  }, [groupClassId]);

  // ── Join Agora + socket ────────────────────────────────────────────────────
  useEffect(() => {
    const join = async () => {
      try {
        const { data } = await api.get(`/agora/token?channel=${channelName}&role=publisher`);
        if (destroyedRef.current) return;

        const { token, uid, appId } = data;
        setMyUid(uid);

        const storedName = localStorage.getItem("userName") || (userRole === "teacher" ? "Teacher" : "Student");
        const storedId   = localStorage.getItem("userId") || String(uid);
        setMyName(storedName);
        myUserIdRef.current = storedId;

        const c = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = c;

        await c.setClientRole(userRole === "teacher" ? "host" : "audience");

        // ── Agora remote track handlers ──
        c.on("user-published", async (user, mediaType) => {
          await c.subscribe(user, mediaType);
          if (destroyedRef.current) return;
          setRemoteUsers(prev => {
            const idx = prev.findIndex(u => u.uid === user.uid);
            const entry = idx >= 0 ? { ...prev[idx] } : { uid: user.uid, audioTrack: null, videoTrack: null };
            if (mediaType === "audio") entry.audioTrack = user.audioTrack;
            else                       entry.videoTrack = user.videoTrack;
            if (idx >= 0) return prev.map((u, i) => i === idx ? entry : u);
            return [...prev, entry];
          });
        });

        c.on("user-unpublished", (user, mediaType) => {
          setRemoteUsers(prev => prev.map(u =>
            u.uid === user.uid
              ? { ...u, ...(mediaType === "audio" ? { audioTrack: null } : { videoTrack: null }) }
              : u
          ));
        });

        c.on("user-left", (user) => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });

        await c.join(appId, channelName, token, uid);
        if (destroyedRef.current) return;
        joinedRef.current = true;

        // Usage tracking — teacher only (prevents double-counting per class)
        if (userRole === "teacher" && !trackingStartedRef.current) {
          trackingStartedRef.current = true;
          api.post('/agora-usage/start', { channelName, bookingId: groupClassId }).catch(() => {});
        }

        // ── Publish tracks ──
        if (userRole === "teacher") {
          let audioTrack, videoTrack;
          try {
            const warm = await navigator.mediaDevices.getUserMedia({ audio: true });
            warm.getTracks().forEach(t => t.stop());
          } catch (_) {}
          try {
            [audioTrack, videoTrack] = await Promise.all([
              AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" }),
              AgoraRTC.createCameraVideoTrack(),
            ]);
          } catch (_) {
            audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
          }
          if (destroyedRef.current) {
            audioTrack?.stop(); audioTrack?.close();
            videoTrack?.stop(); videoTrack?.close();
            return;
          }
          localAudioTrackRef.current = audioTrack;
          localVideoTrackRef.current = videoTrack || null;
          const toPublish = [audioTrack, videoTrack].filter(Boolean);
          await c.publish(toPublish);
        } else {
          // Pre-create mic track so promotion is instant
          try {
            const warm = await navigator.mediaDevices.getUserMedia({ audio: true });
            warm.getTracks().forEach(t => t.stop());
          } catch (_) {}
          try {
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
            if (!destroyedRef.current) localAudioTrackRef.current = audioTrack;
            else { audioTrack.stop(); audioTrack.close(); }
          } catch (_) {}
        }

        setJoined(true);

        // ── Socket ──
        const authToken = localStorage.getItem("token");
        const sock = io(API_URL, { auth: { token: authToken }, transports: ["websocket"] });
        socketRef.current = sock;

        sock.on("connect", () => {
          sock.emit("join-group-room", { groupClassId });
        });

        sock.on("group-user-joined", ({ userId, userName, role }) => {
          setParticipants(prev => {
            if (prev.find(p => p.userId === userId)) return prev;
            return [...prev, { userId, userName, role, isPromoted: false }];
          });
        });

        sock.on("group-user-left", ({ userId }) => {
          setParticipants(prev => prev.filter(p => p.userId !== userId));
          setHandRaised(prev => { const s = new Set(prev); s.delete(userId); return s; });
        });

        sock.on("group-hand-raise", ({ userId, userName }) => {
          setHandRaised(prev => new Set([...prev, userId]));
          // Ensure participant is listed
          setParticipants(prev => {
            if (prev.find(p => p.userId === userId)) return prev;
            return [...prev, { userId, userName, role: "student", isPromoted: false }];
          });
        });

        sock.on("group-hand-lower", ({ userId }) => {
          setHandRaised(prev => { const s = new Set(prev); s.delete(userId); return s; });
        });

        sock.on("group-promote", async ({ targetUserId }) => {
          if (targetUserId === myUserIdRef.current) {
            try {
              await c.setClientRole("host");
              const audio = localAudioTrackRef.current;
              if (audio) await c.publish([audio]);
              setIsSpeaking(true);
              setHandRaised(prev => { const s = new Set(prev); s.delete(targetUserId); return s; });
            } catch (e) {
              console.error("[GroupClass] promote failed:", e);
            }
          }
          setParticipants(prev =>
            prev.map(p => p.userId === targetUserId ? { ...p, isPromoted: true } : p)
          );
          setHandRaised(prev => { const s = new Set(prev); s.delete(targetUserId); return s; });
        });

        sock.on("group-demote", async ({ targetUserId }) => {
          if (targetUserId === myUserIdRef.current) {
            try {
              const audio = localAudioTrackRef.current;
              if (audio) await c.unpublish([audio]);
              await c.setClientRole("audience");
              setIsSpeaking(false);
            } catch (e) {
              console.error("[GroupClass] demote failed:", e);
            }
          }
          setParticipants(prev =>
            prev.map(p => p.userId === targetUserId ? { ...p, isPromoted: false } : p)
          );
        });

        sock.on("group-class-ended", () => {
          doCleanup(false).then(() => { if (onLeave) onLeave(); });
        });

        sock.on("group-kicked", ({ targetUserId }) => {
          if (targetUserId === myUserIdRef.current) {
            doCleanup(false).then(() => { if (onLeave) onLeave(); });
          } else {
            setParticipants(prev => prev.filter(p => p.userId !== targetUserId));
            setHandRaised(prev => { const s = new Set(prev); s.delete(targetUserId); return s; });
          }
        });

      } catch (err) {
        console.error("[GroupAgoraClassroom] join error:", err);
        if (!destroyedRef.current) setError(err?.message || "Failed to join group class");
      }
    };

    join();
    return () => { doCleanup(false); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controls ───────────────────────────────────────────────────────────────
  const toggleMic = async () => {
    const audio = localAudioTrackRef.current;
    if (!audio) return;
    await audio.setEnabled(!micOn);
    setMicOn(v => !v);
  };

  const toggleCam = async () => {
    const video = localVideoTrackRef.current;
    if (!video) return;
    await video.setEnabled(!camOn);
    setCamOn(v => !v);
  };

  const raiseHand = () => {
    const myId = myUserIdRef.current;
    socketRef.current?.emit("group-hand-raise", { groupClassId });
    setHandRaised(prev => new Set([...prev, myId]));
  };

  const lowerHand = () => {
    const myId = myUserIdRef.current;
    socketRef.current?.emit("group-hand-lower", { groupClassId });
    setHandRaised(prev => { const s = new Set(prev); s.delete(myId); return s; });
  };

  const promoteStudent = (targetUserId) => {
    socketRef.current?.emit("group-promote", { groupClassId, targetUserId });
  };

  const demoteStudent = (targetUserId) => {
    socketRef.current?.emit("group-demote", { groupClassId, targetUserId });
  };

  const kickStudent = (targetUserId) => {
    if (!window.confirm("Remove this student from the class?")) return;
    socketRef.current?.emit("group-kick", { groupClassId, targetUserId });
    setParticipants(prev => prev.filter(p => p.userId !== targetUserId));
    setHandRaised(prev => { const s = new Set(prev); s.delete(targetUserId); return s; });
  };

  const handleLeave = async () => {
    await doCleanup(userRole === "teacher");
    if (onLeave) onLeave();
  };

  // ── Loading / error screens ────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#1a1a2e", borderRadius: 20, padding: 32, textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
          <h2 style={{ color: "#f87171", marginBottom: 8 }}>Could not join class</h2>
          <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: 14 }}>{error}</p>
          <button onClick={onLeave} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 700 }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <Loader2 size={48} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ color: "#94a3b8", fontSize: 16 }}>Joining group class…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Build video grid entries ───────────────────────────────────────────────
  const myId   = myUserIdRef.current;
  const isHost = userRole === "teacher" || isSpeaking;

  // Tiles: local first, then remote users who have video
  const localVideoTrack = localVideoTrackRef.current;
  const localAudioTrack = localAudioTrackRef.current;

  const tiles = [
    {
      key: "local",
      videoTrack: (isHost && camOn) ? localVideoTrack : null,
      audioTrack: null,
      isLocal: true,
      label: myName,
      isTeacher: userRole === "teacher",
      hasHand: handRaised.has(myId),
    },
    ...remoteUsers.map(u => ({
      key: String(u.uid),
      videoTrack: u.videoTrack,
      audioTrack: u.audioTrack,
      isLocal: false,
      label: participants.find(p => p.userId === String(u.uid))?.userName || `User ${u.uid}`,
      isTeacher: participants.find(p => p.userId === String(u.uid))?.role === "teacher",
      hasHand: false,
    })),
  ];

  const gridCols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : 3;

  const myHandUp = handRaised.has(myId);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f0f1a", display: "flex", flexDirection: "column", fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", background: "rgba(0,0,0,0.5)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={18} color="#6366f1" />
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>{classData.title || "Group Class"}</span>
          <span style={{ background: "#6366f120", color: "#818cf8", borderRadius: 8, padding: "2px 10px", fontSize: 12 }}>
            {participants.length + 1} participant{participants.length !== 0 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 14 }}>⏱ {fmtTime(elapsedSec)}</span>
          <button
            onClick={() => setShowPanel(v => !v)}
            style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
          >
            <Users size={14} />
            {showPanel ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Video grid */}
        <div style={{
          flex: 1, padding: 16, overflowY: "auto",
          display: "grid",
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gap: 12, alignContent: "start",
        }}>
          {tiles.map(tile => (
            <VideoTile key={tile.key} {...tile} />
          ))}
        </div>

        {/* Participant panel */}
        {showPanel && (
          <div style={{
            width: 240, background: "rgba(0,0,0,0.4)",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13 }}>Participants</span>
              {handRaised.size > 0 && (
                <span style={{ marginLeft: 8, background: "#f59e0b22", color: "#f59e0b", borderRadius: 8, padding: "2px 8px", fontSize: 11 }}>
                  ✋ {handRaised.size} hand{handRaised.size > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
              {/* Me */}
              <ParticipantRow
                p={{ userId: myId, userName: `${myName} (You)`, role: userRole, isPromoted: isSpeaking || userRole === "teacher" }}
                isTeacher={userRole === "teacher"}
                canControl={false}
                hasHand={myHandUp}
                onPromote={() => {}}
                onDemote={() => {}}
              />
              {/* Others */}
              {participants.map(p => (
                <ParticipantRow
                  key={p.userId}
                  p={p}
                  isTeacher={p.role === "teacher"}
                  canControl={userRole === "teacher"}
                  hasHand={handRaised.has(p.userId)}
                  onPromote={promoteStudent}
                  onDemote={demoteStudent}
                  onKick={kickStudent}
                />
              ))}
              {participants.length === 0 && (
                <div style={{ color: "#475569", fontSize: 12, textAlign: "center", marginTop: 20 }}>
                  Waiting for others to join…
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        padding: "14px 20px", background: "rgba(0,0,0,0.6)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* Mic */}
        <CtrlBtn
          active={micOn}
          disabled={!isHost}
          title={isHost ? (micOn ? "Mute" : "Unmute") : "Raise hand to speak"}
          onClick={isHost ? toggleMic : undefined}
          icon={micOn ? <Mic size={20} /> : <MicOff size={20} />}
          color="#6366f1"
        />

        {/* Camera (teacher only or promoted student) */}
        {(userRole === "teacher" || isSpeaking) && (
          <CtrlBtn
            active={camOn}
            title={camOn ? "Turn off camera" : "Turn on camera"}
            onClick={toggleCam}
            icon={camOn ? <Video size={20} /> : <VideoOff size={20} />}
            color="#6366f1"
          />
        )}

        {/* Raise / Lower hand (students only, not speaking) */}
        {userRole === "student" && !isSpeaking && (
          <CtrlBtn
            active={myHandUp}
            title={myHandUp ? "Lower hand" : "Raise hand to speak"}
            onClick={myHandUp ? lowerHand : raiseHand}
            icon={<Hand size={20} />}
            color="#f59e0b"
          />
        )}

        {/* Leave */}
        <CtrlBtn
          title="Leave class"
          onClick={handleLeave}
          icon={<PhoneOff size={20} />}
          color="#ef4444"
          danger
        />
      </div>
    </div>
  );
}

function CtrlBtn({ active, disabled, title, onClick, icon, color, danger }) {
  const bg = danger
    ? "#ef4444"
    : active
    ? color
    : "rgba(255,255,255,0.1)";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 52, height: 52, borderRadius: "50%", border: "none",
        background: bg, cursor: disabled ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: active || danger ? "#fff" : "#94a3b8",
        opacity: disabled ? 0.4 : 1,
        transition: "transform 0.1s",
      }}
    >
      {icon}
    </button>
  );
}
