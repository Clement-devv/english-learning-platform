// src/context/RingContext.jsx
// Manages the Socket.IO ring connection and ring state for all dashboards.
// Wrap the app with <RingProvider> to enable the ring feature globally.

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";
import { detectActiveRole, getStoredToken } from "../utils/authStorage.js";
import api, { refreshToken, tokenExpiresSoon } from "../api.js";
import { getRingtoneById, DEFAULT_RINGTONE_ID, CUSTOM_RINGTONE_ID, makeCustomRingtone } from "../components/ring/ringtones.js";
import { loadCustomTone, warmCustomTone } from "../components/ring/ringStorage.js";
import { wipeDeviceAndSignOut } from "../utils/deviceWipe.js";
import { invalidateResources, refreshEverythingVisible, emitLiveEvent } from "../lib/queryClient";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";
// Socket lifecycle logger — silent by default so the console isn't spammed
// with connect/disconnect/join chatter on every page nav and HMR reload.
// To re-enable while debugging socket issues, add this line to your .env.local
// and restart the dev server:   VITE_DEBUG_SOCKET=1
const log = (import.meta.env.DEV && import.meta.env.VITE_DEBUG_SOCKET)
  ? (...args) => console.log(...args)
  : () => {};

// "Seen" markers for the missed-call and new-message alerts live on the SERVER
// (GET/POST /ring/alerts-seen), per person, in server time. Missed calls and
// messages newer than the marker are "new". This keeps a cleared alert cleared
// after logout, across devices, for other people sharing the computer, and
// even when this computer's clock is wrong.
const toMs = (d) => (d ? new Date(d).getTime() || 0 : 0);

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

  // ── Server-side "seen" markers (see toMs / comment at top of file) ─────────
  const seenRef        = useRef({ calls: 0, messages: 0, loaded: false });
  const latestMsgTsRef = useRef(0);   // newest message time seen in the last refresh
  const seenLoadRef    = useRef(null);

  const loadSeen = useCallback(() => {
    if (seenRef.current.loaded) return Promise.resolve();
    if (!seenLoadRef.current) {
      seenLoadRef.current = api.get('/ring/alerts-seen')
        .then(({ data }) => {
          seenRef.current = { calls: toMs(data?.calls), messages: toMs(data?.messages), loaded: true };
        })
        .catch(() => { seenRef.current = { ...seenRef.current, loaded: true }; })
        .finally(() => { seenLoadRef.current = null; });
    }
    return seenLoadRef.current;
  }, []);

  // New login → forget the previous person's markers
  useEffect(() => {
    seenRef.current = { calls: 0, messages: 0, loaded: false };
    latestMsgTsRef.current = 0;
  }, [authRole, authToken]);

  // ── Restore missed calls from DB on every login / page reload ─────────────
  // The server persists every missed/timed-out ring to RingLog so the count
  // survives logout, refresh, and cross-device sessions. Only calls newer than
  // this person's server-side "calls seen" marker count as new.
  useEffect(() => {
    const token = getSocketToken() || authToken;
    const role  = authRole || detectActiveRole();
    if (!token || !role) return; // not authenticated yet

    let cancelled = false;
    Promise.all([loadSeen(), api.get('/ring/missed-calls')])
      .then(([, { data }]) => {
        if (cancelled) return;
        const lastSeen = seenRef.current.calls;
        // Server response shape (from apiResponse.ok): { success, incoming, outgoing }
        const list = (data?.incoming || [])
          .map(log => ({
            callerName: log.callerName,
            callerRole: log.callerRole,
            at:         toMs(log.createdAt),
          }))
          .filter(item => item.at > lastSeen);
        setMissedCalls(list);
      })
      .catch(() => {}); // fail silently — badge stays at 0 if endpoint unreachable
    return () => { cancelled = true; };
  }, [authRole, authToken, loadSeen]);

  // ── Compute total unread chat messages so the dashboard banner can show ───
  // Reads /group-chats + /direct-messages (the same endpoints GroupChatList
  // already uses) and sums each chat's unreadCount[role] — but ONLY for chats
  // whose last-message timestamp is newer than the person's "messages seen"
  // marker. Called once on login and then again on every new-message event.
  const refreshUnreadMessages = useCallback(async () => {
    const role = authRole || detectActiveRole();
    if (!role) return;
    const unreadKey = role === "sub-admin" ? "subAdmin" : role;
    await loadSeen();
    const lastSeen = seenRef.current.messages;

    let newest = 0;
    const sumUnread = (items) => {
      let total = 0;
      for (const c of items || []) {
        const ts = toMs(c?.lastMessage?.timestamp);
        if (ts > newest) newest = ts;
        const u = c?.unreadCount?.[unreadKey] || 0;
        if (u > 0 && ts > lastSeen) total += u;
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
      latestMsgTsRef.current = newest;
      // A dismissal may have happened while this request was in flight
      setUnreadMessageCount(seenRef.current.messages > lastSeen ? 0 : total);
    } catch { /* fail silently — banner just stays at 0 */ }
  }, [authRole, loadSeen]);

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

    // The server checks the JWT only during the handshake, so a connected
    // socket never needs a new token. `auth` is a function so that every
    // (re)connect attempt reads the freshest token — refreshing first if it
    // is about to expire — instead of replaying the one from page load.
    const sock = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: false, // connected below, on the next tick
      auth: (cb) => {
        const current = getSocketToken() || authToken;
        if (!tokenExpiresSoon(current)) return cb({ token: current });
        refreshToken()
          .then(fresh => cb({ token: fresh || getSocketToken() || current }))
          .catch(() => cb({ token: current }));
      },
    });
    socketRef.current = sock;
    let loggedError = false; // log a connection problem once, not on every retry
    let authRetries = 0;     // token refresh attempts since the last good connect

    const joinRoom = () => {
      log("[RingContext] Joining user room");
      sock.emit("join-user-room");
      // Also join the role-specific broadcast room so chat events reach this socket
      if (role === "teacher")                           sock.emit("join-teacher-room");
      else if (role === "student")                      sock.emit("join-student-room");
      else if (role === "admin" || role === "sub-admin") sock.emit("join-admin-room");
    };

    let everConnected = false;
    sock.on("connect", () => {
      log("[RingContext] Socket connected:", sock.id);
      loggedError = false;
      authRetries = 0;
      setSocketConnected(true);
      joinRoom();
      // Reconnected after a drop → pushes may have been missed; refresh what's on screen
      if (everConnected) refreshEverythingVisible();
      everConnected = true;
      // Pre-fetch the custom ringtone into RAM so it plays instantly on the
      // first incoming ring — no S3 latency in the hot path.
      if (ringtoneIdRef.current === CUSTOM_RINGTONE_ID) {
        warmCustomTone().catch(() => {});
      }
    });

    // Server says some data changed (server/utils/liveUpdates.js) → refetch those screens
    sock.on("data-changed", ({ keys } = {}) => { if (Array.isArray(keys)) invalidateResources(keys); });
    // Admins: who is in which live class (server/utils/liveUpdates.js → sendPresence)
    sock.on("class-presence", (p) => { if (p?.bookingId) emitLiveEvent("class-presence", p); });

    sock.on("connect_error", async (err) => {
      setSocketConnected(false);
      if (import.meta.env.DEV && !loggedError) {
        loggedError = true;
        console.warn("[RingContext] Live connection problem (will keep retrying):", err.message);
      }
      // A rejected token is not retried automatically by socket.io — refresh
      // it once and connect again (the auth function picks up the new token).
      const msg = err?.message || "";
      // ("revoked": signed out from another device while this one was offline —
      // the renewal attempt then confirms it and erases this device's data)
      if ((msg.includes("expired") || msg.includes("Invalid") || msg.includes("Authentication") || msg.includes("revoked")) && authRetries < 2) {
        authRetries += 1;
        const newToken = await refreshToken();
        if (newToken && socketRef.current === sock) {
          log("[RingContext] Token refreshed — reconnecting socket");
          sock.connect();
        }
        // If refresh also fails, socketConnected=false warning banner remains visible
      }
      // Network errors: socket.io keeps retrying with backoff on its own
    });

    sock.on("disconnect", (reason) => {
      log("[RingContext] Socket disconnected:", reason);
      if (reason !== "io client disconnect") {
        setSocketConnected(false);
      }
    });

    // Socket.IO v4 — reconnect fires on the Manager, but "connect" also
    // fires after every reconnection, so no separate listener is needed.

    // ── This device was signed out from another device ─────────────────────────
    // The server sends this only to the signed-out device's connection.
    sock.on("session-revoked", () => {
      ringtoneRef.current?.stop();
      wipeDeviceAndSignOut({ role, reason: "remote" });
    });

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

    // A message was deleted by its sender — open windows and lists refresh
    sock.on("chat-message-deleted", (data) => {
      setLastChatEvent({ type: data.kind, chatId: String(data.chatId), messageId: data.messageId, deleted: true, at: Date.now() });
    });

    // Typing indicators — forwarded by the server from the chat-msg room
    sock.on("user-typing", (data) => {
      setTypingEvent({ chatId: data.chatId, name: data.name, role: data.role });
    });

    sock.on("user-stopped-typing", ({ chatId }) => {
      setTypingEvent(prev => (prev?.chatId === chatId ? null : prev));
    });

    // No periodic forced reconnect: the token is only checked at handshake,
    // and reconnects fetch a fresh one through the auth function above.

    // Connect on the next tick. React StrictMode (dev) mounts, unmounts and
    // re-mounts every effect; connecting immediately made the first socket get
    // closed mid-handshake ("WebSocket is closed before the connection is
    // established"). The throwaway mount now cancels before connecting.
    const connectTimer = setTimeout(() => sock.connect(), 0);

    return () => {
      clearTimeout(connectTimer);
      ringtoneRef.current?.stop();
      sock.disconnect();
      if (socketRef.current === sock) socketRef.current = null;
      currentRingId.current = null;
    };
  }, [authRole, authToken]);

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
  // Saved on the server, so it stays cleared after logout and on other devices.
  const missedCallsRef = useRef(missedCalls);
  useEffect(() => { missedCallsRef.current = missedCalls; }, [missedCalls]);
  const clearMissedCalls    = useCallback(() => {
    // Locally: hide everything we have now, even if this clock is behind the server's
    const newest = Math.max(0, ...missedCallsRef.current.map(c => c.at || 0));
    seenRef.current = { ...seenRef.current, calls: Math.max(seenRef.current.calls, Date.now(), newest), loaded: true };
    setMissedCalls([]);
    api.post('/ring/alerts-seen', { kind: 'calls' })
      .then(({ data }) => {
        const at = toMs(data?.seenAt);
        if (at) seenRef.current = { ...seenRef.current, calls: Math.max(at, newest) };
      })
      .catch(() => {});
  }, []);
  const missedCallCount     = missedCalls.length;
  // Dismiss the unread-messages dashboard banner.  The actual per-chat unread
  // counts on the server are NOT touched (those reset when the user opens an
  // individual chat).  Saved on the server so a refresh / new login / other
  // device does not bring the banner back until a brand-new message arrives.
  // Called often while the Messages tab is open, so the save is debounced.
  const seenPostTimerRef = useRef(null);
  const markMessagesSeen    = useCallback(() => {
    seenRef.current = {
      ...seenRef.current,
      messages: Math.max(seenRef.current.messages, Date.now(), latestMsgTsRef.current),
      loaded: true,
    };
    setUnreadMessageCount(0);
    clearTimeout(seenPostTimerRef.current);
    seenPostTimerRef.current = setTimeout(() => {
      api.post('/ring/alerts-seen', { kind: 'messages' })
        .then(({ data }) => {
          const at = toMs(data?.seenAt);
          // Server time wins — a fast local clock must not hide real new messages
          if (at) seenRef.current = { ...seenRef.current, messages: Math.max(at, latestMsgTsRef.current) };
        })
        .catch(() => {});
    }, 1500);
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
