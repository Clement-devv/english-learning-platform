// src/context/RingContext.jsx
// Manages the Socket.IO ring connection and ring state for all dashboards.
// Wrap the app with <RingProvider> to enable the ring feature globally.

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

const RingContext = createContext(null);

// Generate a modern notification ringtone using Web Audio API.
// Pattern: three ascending chime tones, pause, repeat.
function makeRingtone() {
  let stopped = false;
  let ctx = null;

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return { stop: () => {} };
  }

  function chime(freq, startTime, duration = 0.18) {
    if (stopped || !ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  function ring() {
    if (stopped || !ctx) return;
    const t = ctx.currentTime;
    // Ascending: C5 → E5 → G5
    chime(523, t);
    chime(659, t + 0.2);
    chime(784, t + 0.4);
    setTimeout(() => { if (!stopped) ring(); }, 1800);
  }

  ring();
  return {
    stop: () => {
      stopped = true;
      try { ctx?.close(); } catch { /* ignore */ }
    },
  };
}

function getSocketToken() {
  return (
    sessionStorage.getItem("teacherToken") ||
    sessionStorage.getItem("studentToken") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("subAdminToken") ||
    localStorage.getItem("teacherToken") ||
    localStorage.getItem("studentToken") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("superAdminToken")
  );
}

export function RingProvider({ children }) {
  const { user, role } = useAuth();
  const socketRef      = useRef(null);
  const ringtoneRef    = useRef(null);

  // Incoming ring state
  const [incoming, setIncoming] = useState(null); // { ringId, callerId, callerName, callerRole }

  // Connect socket when user is logged in
  useEffect(() => {
    const token = getSocketToken();
    if (!token || !role) return;

    const sock = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
    });
    socketRef.current = sock;

    const joinRoom = () => sock.emit("join-user-room");
    sock.on("connect",   joinRoom);
    sock.on("reconnect", joinRoom);

    sock.on("incoming-ring", (data) => {
      // Ignore if already on a ring
      setIncoming((prev) => prev ?? data);
      ringtoneRef.current = makeRingtone();
    });

    sock.on("ring-cancelled", () => {
      ringtoneRef.current?.stop();
      ringtoneRef.current = null;
      setIncoming(null);
    });

    sock.on("ring-timeout", () => {
      ringtoneRef.current?.stop();
      ringtoneRef.current = null;
      setIncoming(null);
    });

    // Feedback events for the caller side
    sock.on("ring-sent",    () => {});
    sock.on("ring-answered", () => {});
    sock.on("ring-declined", () => {});

    return () => {
      ringtoneRef.current?.stop();
      sock.disconnect();
      socketRef.current = null;
    };
  }, [role]);

  const ringUser = useCallback(({ targetUserId, callerName }) => {
    socketRef.current?.emit("ring-call", { targetUserId, callerName });
  }, []);

  const cancelRing = useCallback((ringId) => {
    socketRef.current?.emit("ring-cancel", { ringId });
  }, []);

  const answerRing = useCallback((ringId) => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
    socketRef.current?.emit("ring-answered", { ringId });
    setIncoming(null);
  }, []);

  const declineRing = useCallback((ringId) => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
    socketRef.current?.emit("ring-declined", { ringId });
    setIncoming(null);
  }, []);

  return (
    <RingContext.Provider value={{ ringUser, cancelRing, answerRing, declineRing, incoming, socket: socketRef }}>
      {children}
    </RingContext.Provider>
  );
}

export function useRing() {
  const ctx = useContext(RingContext);
  if (!ctx) throw new Error("useRing must be used inside <RingProvider>");
  return ctx;
}
