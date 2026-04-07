// useClassroomCore.js
// Shared attendance + timer logic for both Agora and Google Meet classrooms.
//
// Design principles:
//   - Poll only ever sets presence to TRUE (DB confirms join). Never forces false.
//   - Agora callbacks in AgoraClassroom.jsx handle setting presence FALSE when someone leaves.
//   - Google Meet presence never goes false (we can't detect when someone leaves an external tab).
//   - Timer starts only when the SERVER has set classStartedAt (both join records confirmed).
//   - bothActiveStartRef is anchored to classStartedAt on fresh sessions so background-throttled
//     tabs (Google Meet open in another tab) still compute correct elapsed time.

import { useState, useEffect, useRef, useCallback } from "react";
import api from "../../api";

export function useClassroomCore({ bookingId, userRole, duration }) {

  // ── Presence ──────────────────────────────────────────────────────────────
  const [isTeacherPresent, setIsTeacherPresent] = useState(userRole === "teacher");
  const [isStudentPresent, setIsStudentPresent] = useState(userRole === "student");
  const teacherPresentRef = useRef(userRole === "teacher");
  const studentPresentRef = useRef(userRole === "student");

  useEffect(() => { teacherPresentRef.current = isTeacherPresent; }, [isTeacherPresent]);
  useEffect(() => { studentPresentRef.current = isStudentPresent; }, [isStudentPresent]);

  // ── Timer state ────────────────────────────────────────────────────────────
  const [timeElapsed,    setTimeElapsed]    = useState(0);
  const [bothActiveTime, setBothActiveTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [classStarted,   setClassStarted]   = useState(false);

  const classStartedRef    = useRef(false);
  const timerRef           = useRef(null);
  const syncRef            = useRef(null);
  const classStartedAtRef  = useRef(null);
  const bothActiveStartRef = useRef(null);
  const bothActiveAccRef   = useRef(0);
  const joinConfirmedRef   = useRef(false);
  const hasAutoCompletedRef = useRef(false);

  useEffect(() => { classStartedRef.current = classStarted; }, [classStarted]);

  // ── Auto-complete + dispute state ──────────────────────────────────────────
  const [autoCompleting,    setAutoCompleting]    = useState(false);
  const [completionResult,  setCompletionResult]  = useState(null);
  const [showLeaveModal,    setShowLeaveModal]     = useState(false);
  const [disputeOpen,       setDisputeOpen]        = useState(false);
  const [disputeReason,     setDisputeReason]      = useState("network_issue");
  const [disputeDesc,       setDisputeDesc]        = useState("");
  const [disputeSubmitting, setDisputeSubmitting]  = useState(false);
  const [disputeSubmitted,  setDisputeSubmitted]   = useState(false);

  // ── Computed ───────────────────────────────────────────────────────────────
  const classDurationSeconds = (duration || 60) * 60;
  const requiredTime         = Math.floor(classDurationSeconds * 0.83);
  const timeRemaining        = Math.max(0, classDurationSeconds - timeElapsed);
  const completionPct        = Math.min(100, Math.round((bothActiveTime / requiredTime) * 100));

  const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds)) return "--:--";
    const s   = Math.max(0, Math.round(seconds));
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const formatMinutes = (seconds) => {
    const m = Math.floor((seconds || 0) / 60);
    const s = (seconds || 0) % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  // ── Timer ──────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    if (!classStartedAtRef.current) classStartedAtRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - classStartedAtRef.current) / 1000);
      setTimeElapsed(elapsed);

      if (teacherPresentRef.current && studentPresentRef.current) {
        if (!bothActiveStartRef.current) {
          // Fresh session (acc === 0): anchor to server classStartedAt so every client
          // computes an identical value regardless of when their tab started the timer.
          // After a leave/rejoin (acc > 0): use local Date.now() as the new segment start.
          bothActiveStartRef.current = bothActiveAccRef.current === 0
            ? classStartedAtRef.current
            : Date.now();
        }
        const seg = Math.floor((Date.now() - bothActiveStartRef.current) / 1000);
        setBothActiveTime(bothActiveAccRef.current + seg);
      } else {
        if (bothActiveStartRef.current) {
          bothActiveAccRef.current += Math.floor((Date.now() - bothActiveStartRef.current) / 1000);
          bothActiveStartRef.current = null;
        }
        setBothActiveTime(bothActiveAccRef.current);
      }
    }, 1000);
  }, []);

  // ── Helper: initialise timer from a known classStartedAt timestamp ─────────
  const initTimerFromSession = useCallback((session) => {
    if (!session?.classStartedAt || classStartedRef.current) return;

    classStartedRef.current   = true;
    classStartedAtRef.current = new Date(session.classStartedAt).getTime();

    const elapsed = Math.floor((Date.now() - classStartedAtRef.current) / 1000);
    setTimeElapsed(elapsed);

    // Anchor the running segment to class start on fresh sessions (acc === 0).
    // This means bothActiveTime = elapsed even when the tab is in the background
    // (throttled setInterval), because the segment start is a real timestamp.
    if (!bothActiveStartRef.current && bothActiveAccRef.current === 0) {
      bothActiveStartRef.current = classStartedAtRef.current;
      setBothActiveTime(elapsed);
    } else {
      bothActiveAccRef.current = Math.max(session.bothActiveTime || 0, bothActiveAccRef.current);
      setBothActiveTime(bothActiveAccRef.current);
    }

    setClassStarted(true);
    setIsTimerRunning(true);
    startTimer();
  }, [startTimer]);

  // ── joinSession ────────────────────────────────────────────────────────────
  const joinSession = useCallback(async () => {
    try {
      const { data } = await api.post("/classroom/attendance", {
        bookingId, userRole, action: "join", timestamp: new Date().toISOString(),
      });
      const s = data.session;

      if (s) {
        // Update presence from DB — only ever set to true here
        if (s.teacherJoinedAt && !s.teacherLeftAt) {
          teacherPresentRef.current = true;
          setIsTeacherPresent(true);
        }
        if (s.studentJoinedAt && !s.studentLeftAt) {
          studentPresentRef.current = true;
          setIsStudentPresent(true);
        }
        // If class already started (both joined before us), start timer now
        initTimerFromSession(s);
      }

      joinConfirmedRef.current = true;
      console.log(`[classroom] joined as ${userRole}, bookingId=${bookingId}`);
    } catch (err) {
      console.error("[classroom] joinSession failed, retrying in 3s:", err);
      setTimeout(joinSession, 3000);
    }
  }, [bookingId, userRole, initTimerFromSession]);

  // ── sendHeartbeat ──────────────────────────────────────────────────────────
  // Computed from refs so background-throttled tabs send accurate values.
  const sendHeartbeat = useCallback(async () => {
    const seg     = bothActiveStartRef.current
      ? Math.floor((Date.now() - bothActiveStartRef.current) / 1000) : 0;
    const current = bothActiveAccRef.current + seg;
    setBothActiveTime(current);
    try {
      await api.post("/classroom/attendance", {
        bookingId, userRole, action: "heartbeat",
        timestamp: new Date().toISOString(), activeTime: current,
      });
    } catch (_) {}
  }, [bookingId, userRole]);

  // ── leaveSession ───────────────────────────────────────────────────────────
  const leaveSession = useCallback(async (finalBothActiveTime) => {
    clearInterval(syncRef.current);
    try {
      await api.post("/classroom/attendance", {
        bookingId, userRole, action: "leave",
        timestamp: new Date().toISOString(), activeTime: finalBothActiveTime,
      });
      console.log("[classroom] left session");
    } catch (_) {}
  }, [bookingId, userRole]);

  // ── getCurrentBothActive — reads from refs (not stale state) ──────────────
  const getCurrentBothActive = useCallback(() => {
    const seg = bothActiveStartRef.current
      ? Math.floor((Date.now() - bothActiveStartRef.current) / 1000) : 0;
    return bothActiveAccRef.current + seg;
  }, []);

  // ── handleAutoComplete ─────────────────────────────────────────────────────
  const handleAutoComplete = useCallback(async (currentBothActiveTime) => {
    if (hasAutoCompletedRef.current) return;
    hasAutoCompletedRef.current = true;
    clearInterval(timerRef.current);
    timerRef.current = null;
    setAutoCompleting(true);

    try {
      let best = currentBothActiveTime || 0;
      try {
        const { data } = await api.get(`/classroom/session/${bookingId}`);
        best = Math.max(best, data?.session?.bothActiveTime || 0);
      } catch (_) {}

      const { data } = await api.post("/classroom/auto-complete", {
        bookingId, clientBothActiveTime: best, callerRole: userRole,
      });
      setCompletionResult(data);
      console.log("[classroom] auto-complete result:", data);
    } catch (err) {
      console.error("[classroom] auto-complete error:", err);
      setCompletionResult({
        completed: false, missed: true, error: true,
        message: "Could not determine class outcome. Please contact admin.",
      });
    } finally {
      setAutoCompleting(false);
    }
  }, [bookingId, userRole]);

  const handleAutoCompleteRef = useRef(handleAutoComplete);
  useEffect(() => { handleAutoCompleteRef.current = handleAutoComplete; }, [handleAutoComplete]);

  // Auto-complete when class timer hits zero
  useEffect(() => {
    if (timeRemaining === 0 && classStarted && !hasAutoCompletedRef.current) {
      const cur = getCurrentBothActive();
      setBothActiveTime(cur);
      handleAutoCompleteRef.current(cur);
    }
  }, [timeRemaining, classStarted, getCurrentBothActive]);

  // ── Main effect: join + poll + heartbeat ───────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;

    // Restore from sessionStorage on page refresh
    const REFRESH_KEY = `classroom_refresh_${bookingId}`;
    try {
      const raw = sessionStorage.getItem(REFRESH_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Date.now() - saved.savedAt < 60_000) {
          bothActiveAccRef.current = saved.bothActiveAcc;
          if (saved.classStartedAt) classStartedAtRef.current = saved.classStartedAt;
          setBothActiveTime(saved.bothActiveAcc);
        }
      }
    } catch (_) {}
    sessionStorage.removeItem(REFRESH_KEY);

    joinSession();

    let pollInterval = 2000;
    let pollTimeout  = null;

    const poll = async () => {
      try {
        const { data } = await api.get(`/classroom/session/${bookingId}`);
        const s = data?.session;
        if (!s) { pollTimeout = setTimeout(poll, pollInterval); return; }

        // ── Presence: poll only ever sets to TRUE ──────────────────────────
        // Agora callbacks in AgoraClassroom handle setting back to false.
        if (s.teacherJoinedAt && !s.teacherLeftAt && !teacherPresentRef.current) {
          teacherPresentRef.current = true;
          setIsTeacherPresent(true);
        }
        if (s.studentJoinedAt && !s.studentLeftAt && !studentPresentRef.current) {
          studentPresentRef.current = true;
          setIsStudentPresent(true);
        }

        // ── Start timer once server confirms classStartedAt ────────────────
        if (s.classStartedAt && !classStartedRef.current) {
          initTimerFromSession(s);
          pollInterval = 5000; // slow down once class is active
        }

        // ── Detect completion triggered by the other participant ───────────
        if ((s.status === "completed" || s.status === "incomplete") && !hasAutoCompletedRef.current) {
          hasAutoCompletedRef.current = true;
          clearInterval(timerRef.current);
          const cur = getCurrentBothActive();
          setBothActiveTime(cur);
          handleAutoCompleteRef.current(cur);
          return; // stop polling
        }
      } catch (_) {}

      pollTimeout = setTimeout(poll, pollInterval);
    };

    pollTimeout = setTimeout(poll, pollInterval);

    // Heartbeat every 15 s — computed from refs, not stale state
    syncRef.current = setInterval(sendHeartbeat, 15000);

    return () => {
      clearTimeout(pollTimeout);
      clearInterval(timerRef.current);
      clearInterval(syncRef.current);
      leaveSession(getCurrentBothActive());
    };
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── visibilitychange: resync when user returns from Google Meet tab ────────
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== "visible" || !bookingId || !classStarted) return;

      // Immediately update display from refs so the tab shows correct time the
      // instant it becomes visible — no waiting for the API round-trip or the
      // next (potentially throttled) setInterval tick.
      if (classStartedAtRef.current) {
        setTimeElapsed(Math.floor((Date.now() - classStartedAtRef.current) / 1000));
        const segStart = bothActiveStartRef.current || classStartedAtRef.current;
        const seg = segStart ? Math.floor((Date.now() - segStart) / 1000) : 0;
        setBothActiveTime(bothActiveAccRef.current + seg);
      }

      try {
        const { data } = await api.get(`/classroom/session/${bookingId}`);
        const s = data?.session;
        if (!s) return;

        // Re-check presence — polls may have been throttled while in background
        if (s.teacherJoinedAt && !s.teacherLeftAt) {
          teacherPresentRef.current = true;
          setIsTeacherPresent(true);
        }
        if (s.studentJoinedAt && !s.studentLeftAt) {
          studentPresentRef.current = true;
          setIsStudentPresent(true);
        }

        // Resync elapsed time
        if (s.classStartedAt) {
          classStartedAtRef.current = new Date(s.classStartedAt).getTime();
          setTimeElapsed(Math.floor((Date.now() - classStartedAtRef.current) / 1000));
        }

        // Resync bothActiveTime — use classStartedAtRef as fallback segment anchor
        // so background-throttled tabs (bothActiveStartRef may be null) still
        // compute the correct elapsed time.
        const segStart    = bothActiveStartRef.current || classStartedAtRef.current;
        const runSeg      = segStart ? Math.floor((Date.now() - segStart) / 1000) : 0;
        const localTotal  = bothActiveAccRef.current + runSeg;
        const serverTotal = s.bothActiveTime || 0;

        if (serverTotal > localTotal) {
          bothActiveAccRef.current = serverTotal - runSeg;
          setBothActiveTime(serverTotal);
        } else {
          setBothActiveTime(localTotal);
        }
      } catch (_) {}
    };

    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [bookingId, classStarted]);

  // ── handleRefresh ──────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    const cur = getCurrentBothActive();
    sessionStorage.setItem(`classroom_refresh_${bookingId}`, JSON.stringify({
      bothActiveAcc: cur, classStartedAt: classStartedAtRef.current, savedAt: Date.now(),
    }));
    sendHeartbeat();
    setTimeout(() => window.location.reload(), 300);
  }, [bookingId, getCurrentBothActive, sendHeartbeat]);

  // ── handleLeaveEarly ───────────────────────────────────────────────────────
  const handleLeaveEarly = useCallback(async () => {
    sessionStorage.removeItem(`classroom_refresh_${bookingId}`);
    clearInterval(timerRef.current);
    timerRef.current = null;
    clearInterval(syncRef.current);
    setShowLeaveModal(false);

    const cur = getCurrentBothActive();
    setBothActiveTime(cur);

    // Wait for joinSession to complete if still in progress
    if (!joinConfirmedRef.current) {
      await new Promise(resolve => {
        const t     = setTimeout(resolve, 3000);
        const check = setInterval(() => {
          if (joinConfirmedRef.current) { clearInterval(check); clearTimeout(t); resolve(); }
        }, 100);
      });
    }

    await leaveSession(cur);
    hasAutoCompletedRef.current = false;
    handleAutoCompleteRef.current(cur);
  }, [bookingId, getCurrentBothActive, leaveSession]);

  return {
    // Presence state + setters (AgoraClassroom uses setters for SDK callbacks)
    isTeacherPresent, setIsTeacherPresent,
    isStudentPresent, setIsStudentPresent,
    teacherPresentRef, studentPresentRef,

    // Timer state
    timeElapsed, bothActiveTime, setBothActiveTime,
    isTimerRunning, classStarted,
    timeRemaining, completionPct, requiredTime,
    classDurationSeconds,

    // Completion
    autoCompleting, completionResult,

    // Leave / dispute
    showLeaveModal, setShowLeaveModal,
    disputeOpen, setDisputeOpen,
    disputeReason, setDisputeReason,
    disputeDesc, setDisputeDesc,
    disputeSubmitting, setDisputeSubmitting,
    disputeSubmitted, setDisputeSubmitted,

    // Actions
    handleRefresh, handleLeaveEarly, joinConfirmedRef,

    // Formatters
    formatTime, formatMinutes,
  };
}
