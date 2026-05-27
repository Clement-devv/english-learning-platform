// src/context/RingContext.jsx
// Manages the Socket.IO ring connection and ring state for all dashboards.
// Wrap the app with <RingProvider> to enable the ring feature globally.

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";
import { detectActiveRole, getStoredToken } from "../utils/authStorage.js";
import api, { refreshToken } from "../api.js";
import { getRingtoneById, DEFAULT_RINGTONE_ID, CUSTOM_RINGTONE_ID, makeCustomRingtone } from "../components/ring/ringtones.js";
import { loadCustomTone, warmCustomTone } from "../components/ring/ringStorage.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";
// Socket lifecycle logger — silent by default so the console isn't spammed
// with connect/disconnect/join chatter on every page nav and HMR reload.
// To re-enable while debugging socket issues, add this line to your .env.local
// and restart the dev server:   VITE_DEBUG_SOCKET=1
const log = (import.meta.env.DEV && import.meta.env.VITE_DEBUG_SOCKET)
  ? (...args) => console.log(...args)
  : () => {};

// localStorage key — remembers the last time the user acknowledged the missed-call
// alert (clicked the dashboard banner OR opened the Ring tab). When the app boots
// and fetches missed calls from the server, only records newer than this timestamp
// count as "unread" — so a dismissed alert does NOT reappear on refresh.
// Cleared on logout via clearAuth() so a different user on the same browser
// starts fresh.
const MISSED_SEEN_KEY = "ring_missed_last_seen_at";
function getMissedLastSeenAt() {
  const raw = localStorage.getItem(MISSED_SEEN_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}
function setMissedLastSeenAt(ts) {
  try { localStorage.setItem(MISSED_SEEN_KEY, String(ts)); } catch { /* ignore quota errors */ }
}

// Same idea for the unread-messages dashboard banner — remembers when the user
// last acknowledged the messages alert.  Only chats whose lastMessage.timestamp
// is newer than this value contribute to the banner count, so a dismissed
// alert does NOT reappear on refresh.  Cleared on logout.
const MSG_SEEN_KEY = "chat_messages_last_seen_at";
function getMessagesLastSeenAt() {
  const raw = localStorage.getItem(MSG_SEEN_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}
function setMessagesLastSeenAt(ts) {
  try { localStorage.setItem(MSG_SEEN_KEY, String(ts)); } catch { /* ignore quota errors */ }
}

// Storage-based fallback — used when useAuth() hasn't hydrated yet (e.g. HMR or first paint)
function getSocketToken() {
  const role = detectActiveRole();
  return role ? getStoredToken(role) : null;
}

const RingContext = createContext(null);


export function RingProvider({ children }) {
  const { role: authRole, token: authToken } = useAuth();
  const socketRef       = useRef(null);
  const ringtoneRef     = useRef(null);
  const currentRingId   = useRef(null);  // ringId of our active outgoing call
  const incomingRef     = useRef(null);  // mirror of incoming state for event handlers

  const [incoming,        setIncoming]        = useState(null);
  const [callerEvent,     setCallerEvent]     = useState(null);
  const [missedCalls,     setMissedCalls]     = useState([]);
  // Total unread chat messages across all group chats + DMs, filtered by the
  // localStorage "last seen at" timestamp so a dismissed banner stays dismissed
  // until a brand-new message arrives.
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  // null = not yet known, true = connected, false = failed (auth error or offline)
  const [socketConnected, setSocketConnected] = useState(null);
  // Incrementing this triggers the socket effect to re-run with a fresh token
  const [reconnectKey,    setReconnectKey]    = useState(0);
  // ── Chat real-time state ────────────────────────────────────────────────────
  // Set whenever a new DM or group message arrives — components watch this to re-fetch
  const [lastChatEvent,   setLastChatEvent]   = useState(null);
  // Set when someone is typing in a chat room the user has joined
  const [typingEvent,     setTypingEvent]     = useState(null);

  // ── Ringtone selection ──────────────────────────────────────────────────────
  const [ringtoneId, setRingtoneIdState] = useState(
    () => localStorage.getItem("ring_tone_id") || DEFAULT_RINGTONE_ID
  );
  // Ref so socket handlers always read the latest value without stale closures
  const ringtoneIdRef = useRef(ringtoneId);
  useEffect(() => { ringtoneIdRef.current = ringtoneId; }, [ringtoneId]);

  const setRingtoneId = useCallback((id) => {
    localStorage.setItem("ring_tone_id", id);
    setRingtoneIdState(id);
    ringtoneIdRef.current = id;
    // Pre-warm the cache whenever the user selects the custom ringtone
    if (id === CUSTOM_RINGTONE_ID) warmCustomTone().catch(() => {});
  }, []);

  // Keep incomingRef in sync so socket handlers can read current value without stale closure
  useEffect(() => { incomingRef.current = incoming; }, [incoming]);

  // ── Reset all in-memory ring/chat state when the user logs out ─────────────
  // The socket disconnect on logout is async — an in-flight 'incoming-ring'
  // packet can still land in setIncoming() during the close window, which
  // would leave the modal painted on the login screen.  Wiping state here
  // also prevents the previous user's missed-call count / unread badge from
  // briefly flashing for the next user on a shared device, and guarantees
  // the next login starts from a clean slate so the fresh /ring/missed-calls
  // fetch is what populates the dashboard banner.
  useEffect(() => {
    if (authRole && authToken) return; // still signed in — nothing to reset
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
    setIncoming(null);
    setCallerEvent(null);
    setMissedCalls([]);
    setUnreadMessageCount(0);
    setLastChatEvent(null);
    setTypingEvent(null);
  }, [authRole, authToken]);

  // ── Restore missed calls from DB on every login / page reload ─────────────
  // The server persists every missed/timed-out ring to RingLog so the count
  // survives logout, refresh, and cross-device sessions.
  useEffect(() => {
    const token = getSocketToken() || authToken;
    const role  = authRole || detectActiveRole();
    if (!token || !role) return; // not authenticated yet

    api.get('/ring/missed-calls')
      .then(({ data }) => {
        const lastSeen = getMissedLastSeenAt();
        // Server response shape (from apiResponse.ok): { success, incoming, outgoing }
        // — incoming is at the top level, NOT wrapped in `data.data`.
        // Only treat records newer than the user's last dismissal as "unread".
        // This is what keeps the alert from re-appearing on refresh after the
        // user has already acknowledged it.
        const list = (data?.incoming || [])
          .map(log => ({
            callerName: log.callerName,
            callerRole: log.callerRole,
            at:         new Date(log.createdAt).getTime(),
          }))
          .filter(item => item.at > lastSeen);
        setMissedCalls(list);
      })
      .catch(() => {}); // fail silently — badge stays at 0 if endpoint unreachable
  }, [authRole, authToken]); // re-run whenever auth changes (login / token refresh)

  // ── Compute total unread chat messages so the dashboard banner can show ───
  // Reads /group-chats + /direct-messages (the same endpoints GroupChatList
  // already uses) and sums each chat's unreadCount[role] — but ONLY for chats
  // whose last-message timestamp is newer than the user's "last seen" marker.
  // Called once on login and then again on every new-message socket event.
  const refreshUnreadMessages = useCallback(async () => {
    const role = authRole || detectActiveRole();
    if (!role) return;
    const unreadKey = role === "sub-admin" ? "subAdmin" : role;
    const lastSeen  = getMessagesLastSeenAt();

    const sumUnread = (items) => {
      let total = 0;
      for (const c of items || []) {
        const u = c?.unreadCount?.[unreadKey] || 0;
        if (u <= 0) continue;
        const ts = c?.lastMessage?.timestamp
          ? new Date(c.lastMessage.timestamp).getTime()
          : 0;
        if (ts > lastSeen) total += u;
      }
      return total;
    };

    try {
      const [gc, dm] = await Promise.allSettled([
        api.get("/group-chats"),
        api.get("/direct-messages"),
      ]);
      let total = 0;
      if (gc.status === "fulfilled") total += sumUnread(gc.value?.data?.chats);
      if (dm.status === "fulfilled") total += sumUnread(dm.value?.data?.dms);
      setUnreadMessageCount(total);
    } catch { /* fail silently — banner just stays at 0 */ }
  }, [authRole]);

  // Initial fetch + refetch on auth change
  useEffect(() => {
    const token = getSocketToken() || authToken;
    const role  = authRole || detectActiveRole();
    if (!token || !role) return;
    refreshUnreadMessages();
  }, [authRole, authToken, refreshUnreadMessages]);

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
      // Also join the role-specific broadcast room so chat events reach this socket
      if (role === "teacher")                           sock.emit("join-teacher-room");
      else if (role === "student")                      sock.emit("join-student-room");
      else if (role === "admin" || role === "sub-admin") sock.emit("join-admin-room");
    };

    sock.on("connect", () => {
      log("[RingContext] Socket connected:", sock.id);
      setSocketConnected(true);
      joinRoom();
      // Pre-fetch the custom ringtone into RAM so it plays instantly on the
      // first incoming ring — no S3 latency in the hot path.
      if (ringtoneIdRef.current === CUSTOM_RINGTONE_ID) {
        warmCustomTone().catch(() => {});
      }
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
      // Stop any previous ringtone before starting a new one — prevents AudioContext leak
      // if two incoming-ring events arrive before the first is answered/declined.
      ringtoneRef.current?.stop();
      setIncoming((prev) => prev ?? data);

      const toneId = ringtoneIdRef.current;

      if (toneId === CUSTOM_RINGTONE_ID) {
        // Custom tone requires an async IDB read.
        // Put a cancellable placeholder so stop() works immediately if the user
        // answers/declines before the buffer has loaded.
        let cancelled = false;
        ringtoneRef.current = { stop: () => { cancelled = true; } };

        loadCustomTone()
          .then(buf => {
            if (cancelled) return;
            if (buf) {
              const tone = makeCustomRingtone(buf);
              if (cancelled) { tone.stop(); return; }   // answered during decode
              ringtoneRef.current = tone;
            } else {
              // No custom file saved yet — fall back to default chime
              if (!cancelled) ringtoneRef.current = getRingtoneById(DEFAULT_RINGTONE_ID).make();
            }
          })
          .catch(() => {
            if (!cancelled) ringtoneRef.current = getRingtoneById(DEFAULT_RINGTONE_ID).make();
          });
      } else {
        ringtoneRef.current = getRingtoneById(toneId).make();
      }
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

    sock.on("ring-declined", ({ ringId, by, reason }) => {
      // reason === 'muted'   → target has calls muted (server auto-declined)
      // reason === 'offline' → target went offline
      // reason === undefined → target clicked Decline
      setCallerEvent({ type: "declined", ringId, by, reason });
      currentRingId.current = null;
    });

    // ── Chat real-time events ──────────────────────────────────────────────────
    // new-direct-message and new-group-message arrive via the role-specific room
    // that joinRoom() now also joins.  Components watch lastChatEvent to re-fetch.
    sock.on("new-direct-message", (data) => {
      // Normalize dmId → chatId so consumers use one field name
      setLastChatEvent({ type: "dm", chatId: data.dmId, ...data, at: Date.now() });
    });

    sock.on("new-group-message", (data) => {
      setLastChatEvent({ type: "group", chatId: data.chatId, ...data, at: Date.now() });
    });

    // Typing indicators — forwarded by the server from the chat-msg room
    sock.on("user-typing", (data) => {
      setTypingEvent({ chatId: data.chatId, name: data.name, role: data.role });
    });

    sock.on("user-stopped-typing", ({ chatId }) => {
      setTypingEvent(prev => (prev?.chatId === chatId ? null : prev));
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

  // Whenever a new DM or group message arrives via socket, recompute the
  // unread badge so the dashboard banner reflects the new state in real time.
  useEffect(() => {
    if (!lastChatEvent) return;
    refreshUnreadMessages();
  }, [lastChatEvent, refreshUnreadMessages]);

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

  const consumeCallerEvent  = useCallback(() => setCallerEvent(null), []);
  // Dismiss the unread missed-call badge.  DB records are NOT deleted — the
  // RingTab's MissedCalls history list still shows them (its "Clear" button
  // handles the actual DB delete).  We persist a "last seen" timestamp so
  // the badge does NOT reappear when the user refreshes or logs back in:
  // on next fetch, records older than this timestamp are filtered out.
  const clearMissedCalls    = useCallback(() => {
    setMissedLastSeenAt(Date.now());
    setMissedCalls([]);
  }, []);
  const missedCallCount     = missedCalls.length;
  // Dismiss the unread-messages dashboard banner.  The actual per-chat unread
  // counts on the server are NOT touched (those reset when the user opens an
  // individual chat).  We persist the dismissal so a refresh does not bring
  // the banner back until a brand-new message arrives.
  const markMessagesSeen    = useCallback(() => {
    setMessagesLastSeenAt(Date.now());
    setUnreadMessageCount(0);
  }, []);
  const consumeLastChatEvent = useCallback(() => setLastChatEvent(null), []);

  // ── Chat room + typing helpers ────────────────────────────────────────────
  const joinChatRoom   = useCallback((chatId) => {
    socketRef.current?.emit("join-chat-room",  { chatId });
  }, []);
  const leaveChatRoom  = useCallback((chatId) => {
    socketRef.current?.emit("leave-chat-room", { chatId });
  }, []);
  const emitTyping     = useCallback((chatId, senderName) => {
    socketRef.current?.emit("typing-start", { chatId, senderName });
  }, []);
  const emitStopTyping = useCallback((chatId) => {
    socketRef.current?.emit("typing-stop",  { chatId });
  }, []);

  return (
    <RingContext.Provider value={{
      ringUser, cancelRing, answerRing, declineRing,
      incoming,
      callerEvent, consumeCallerEvent,
      missedCalls, missedCallCount, clearMissedCalls,
      socketConnected,
      socket: socketRef,
      ringtoneId, setRingtoneId,
      // Chat real-time
      lastChatEvent, consumeLastChatEvent,
      unreadMessageCount, markMessagesSeen, refreshUnreadMessages,
      typingEvent,
      joinChatRoom, leaveChatRoom, emitTyping, emitStopTyping,
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
