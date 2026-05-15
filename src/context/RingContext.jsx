// src/context/RingContext.jsx
// Manages the Socket.IO ring connection and ring state for all dashboards.
// Wrap the app with <RingProvider> to enable the ring feature globally.

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";
import { detectActiveRole, getStoredToken } from "../utils/authStorage.js";
import { refreshToken } from "../api.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";
const log = (...args) => { if (import.meta.env.DEV) console.log(...args); };

// Storage-based fallback — used when useAuth() hasn't hydrated yet (e.g. HMR or first paint)
function getSocketToken() {
  const role = detectActiveRole();
  return role ? getStoredToken(role) : null;
}

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

export function RingProvider({ children }) {
  const { role: authRole, token: authToken } = useAuth();
  const socketRef       = useRef(null);
  const ringtoneRef     = useRef(null);
  const currentRingId   = useRef(null);  // ringId of our active outgoing call
  const incomingRef     = useRef(null);  // mirror of incoming state for event handlers

  const [incoming,        setIncoming]        = useState(null);
  const [callerEvent,     setCallerEvent]     = useState(null);
  const [missedCalls,     setMissedCalls]     = useState([]);
  // null = not yet known, true = connected, false = failed (auth error or offline)
  const [socketConnected, setSocketConnected] = useState(null);
  // Incrementing this triggers the socket effect to re-run with a fresh token
  const [reconnectKey,    setReconnectKey]    = useState(0);

  // Keep incomingRef in sync so socket handlers can read current value without stale closure
  useEffect(() => { incomingRef.current = incoming; }, [incoming]);

  useEffect(() => {
    // Prefer sessionStorage token — it may be fresher than authToken after a silent refresh
    const token = getSocketToken() || authToken;
    const role  = authRole || detectActiveRole();

    if (!token || !role) {
      log("[RingContext] No token/role — socket not started", { authToken: !!authToken, authRole });
      return;
    }

    log("[RingContext] Starting socket for role:", role);

    const sock = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
    });
    socketRef.current = sock;

    const joinRoom = () => {
      log("[RingContext] Joining user room");
      sock.emit("join-user-room");
    };

    sock.on("connect", () => {
      log("[RingContext] Socket connected:", sock.id);
      setSocketConnected(true);
      joinRoom();
    });

    sock.on("connect_error", async (err) => {
      if (import.meta.env.DEV) console.error("[RingContext] Socket connect_error:", err.message);
      setSocketConnected(false);
      // Auth errors will never resolve on their own — stop retry loop and try
      // to silently refresh the access token, then reconnect.
      if (err.message.includes("expired") || err.message.includes("Invalid") || err.message.includes("Authentication")) {
        sock.disconnect();
        const newToken = await refreshToken();
        if (newToken) {
          log("[RingContext] Token refreshed — reconnecting socket");
          setReconnectKey(k => k + 1);
        }
        // If refresh also fails, socketConnected=false warning banner remains visible
      }
    });

    sock.on("disconnect", (reason) => {
      log("[RingContext] Socket disconnected:", reason);
      if (reason !== "io client disconnect") {
        setSocketConnected(false);
      }
    });

    // Socket.IO v4 — reconnect fires on the Manager, but "connect" also
    // fires after every reconnection, so no separate listener is needed.

    // ── Receiver side ──────────────────────────────────────────────────────────
    sock.on("incoming-ring", (data) => {
      log("[RingContext] incoming-ring received:", data);
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
      if (incomingRef.current) {
        const { callerName, callerRole } = incomingRef.current;
        setMissedCalls((prev) => [...prev, { callerName, callerRole, at: Date.now() }]);
      }
      setIncoming(null);
      currentRingId.current = null;
    });

    // ── Caller side ────────────────────────────────────────────────────────────
    sock.on("ring-sent", ({ ringId }) => {
      log("[RingContext] ring-sent, ringId:", ringId);
      currentRingId.current = ringId;
    });

    sock.on("ring-answered", ({ ringId, by }) => {
      setCallerEvent({ type: "answered", ringId, by });
      currentRingId.current = null;
    });

    sock.on("ring-declined", ({ ringId, by }) => {
      setCallerEvent({ type: "declined", ringId, by });
      currentRingId.current = null;
    });

    // Proactively refresh the JWT 3 minutes before it expires so the socket
    // never goes down mid-session. 15m JWT → refresh at 12m intervals.
    const refreshInterval = setInterval(async () => {
      if (!sock.connected) return;
      log("[RingContext] Proactive token refresh");
      const newToken = await refreshToken();
      if (newToken) {
        // Reconnect with the new token — cleanest way to update socket auth
        sock.disconnect();
        setReconnectKey(k => k + 1);
      }
    }, 12 * 60 * 1000);

    return () => {
      clearInterval(refreshInterval);
      ringtoneRef.current?.stop();
      sock.disconnect();
      socketRef.current = null;
      currentRingId.current = null;
    };
  }, [authRole, authToken, reconnectKey]);

  const ringUser = useCallback(({ targetUserId, targetRole, callerName }) => {
    log("[RingContext] ringUser called. socket ready?", !!socketRef.current?.connected, { targetUserId, targetRole, callerName });
    socketRef.current?.emit("ring-call", { targetUserId, targetRole, callerName });
  }, []);

  // cancelRing uses the stored ringId from ring-sent — no argument needed
  const cancelRing = useCallback(() => {
    if (currentRingId.current) {
      socketRef.current?.emit("ring-cancel", { ringId: currentRingId.current });
      currentRingId.current = null;
    }
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

  const consumeCallerEvent = useCallback(() => setCallerEvent(null), []);
  const clearMissedCalls   = useCallback(() => setMissedCalls([]), []);
  const missedCallCount    = missedCalls.length;

  return (
    <RingContext.Provider value={{
      ringUser, cancelRing, answerRing, declineRing,
      incoming,
      callerEvent, consumeCallerEvent,
      missedCalls, missedCallCount, clearMissedCalls,
      socketConnected,
      socket: socketRef,
    }}>
      {children}
    </RingContext.Provider>
  );
}

export function useRing() {
  const ctx = useContext(RingContext);
  if (!ctx) throw new Error("useRing must be used inside <RingProvider>");
  return ctx;
}
