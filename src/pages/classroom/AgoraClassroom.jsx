// AgoraClassroom.jsx
// Full Agora video classroom — attendance, timer, and VideoCall SDK.
//
// Presence model:
//   - Own presence: set to true in useClassroomCore joinSession (DB confirms our join).
//   - Other user presence: set to true by BOTH the poll (DB) AND the Agora SDK callback.
//     Agora fires onUserJoined faster than the DB poll, so it gives real-time detection.
//   - Setting presence to FALSE: ONLY via Agora onUserLeft callback. Poll never forces false.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import VideoCall from "../VideoCall";
import ContentViewer from "../ContentViewer";
import WhiteboardTab from "../WhiteboardTab";
import api from "../../api";
import { useClassroomCore } from "./useClassroomCore";
import { useDarkMode } from "../../hooks/useDarkMode";
import {
  Video, FileText, PenTool, Clock, Users,
  CheckCircle2, XCircle, Loader, Power, AlertTriangle,
  CheckCircle, X, RefreshCw, PlusCircle,
} from "lucide-react";

export default function AgoraClassroom({ classData, userRole, onLeave, googleMeetLink }) {
  const navigate    = useNavigate();
  const bookingId   = classData?.bookingId || classData?.id;
  const userName    = localStorage.getItem("name") || "User";
  const userId      = localStorage.getItem("userId") || "";
  const channelName = `class-${bookingId}`;

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const { isDarkMode } = useDarkMode();
  const dm = isDarkMode;

  const core = useClassroomCore({ bookingId, userRole, duration: classData?.duration });

  const {
    isTeacherPresent, setIsTeacherPresent,
    isStudentPresent, setIsStudentPresent,
    teacherPresentRef, studentPresentRef,
    timeElapsed, bothActiveTime, isTimerRunning, classStarted,
    timeRemaining, completionPct, requiredTime,
    autoCompleting, completionResult,
    showLeaveModal, setShowLeaveModal,
    disputeOpen, setDisputeOpen,
    disputeReason, setDisputeReason,
    disputeDesc, setDisputeDesc,
    disputeSubmitting, setDisputeSubmitting,
    disputeSubmitted, setDisputeSubmitted,
    handleRefresh, handleLeaveEarly, handleExtendTime,
    minimizeSession, extraSeconds,
    sessionVideoProvider,
    formatTime, formatMinutes,
  } = core;

  const [activeTab,       setActiveTab]       = useState("video");
  const [extendOpen,      setExtendOpen]       = useState(false);
  const [extendLoading,   setExtendLoading]    = useState(false);
  const [extendMsg,       setExtendMsg]        = useState("");
  const [platformOpen,    setPlatformOpen]     = useState(false);
  const [platformSwitching, setPlatformSwitching] = useState(false);
  const [tabSyncNotice,   setTabSyncNotice]    = useState(""); // student: "Teacher switched to Content"
  const [blinkTab,        setBlinkTab]         = useState(null); // student: which tab is pinging
  const [notifyOpen,      setNotifyOpen]       = useState(false); // teacher: notify dropdown open
  const extendRef     = useRef(null);
  const platformRef   = useRef(null);
  const notifyRef     = useRef(null);
  const classroomSockRef = useRef(null);
  const tabSyncTimerRef  = useRef(null);

  // ── Socket: classroom tab sync ────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    const token =
      sessionStorage.getItem("teacherToken") || sessionStorage.getItem("studentToken") ||
      sessionStorage.getItem("adminToken")   || localStorage.getItem("teacherToken")   ||
      localStorage.getItem("studentToken")   || localStorage.getItem("adminToken");

    const sock = io(import.meta.env.VITE_SOCKET_URL || "", {
      transports: ["websocket"],
      auth: { token },
    });
    classroomSockRef.current = sock;

    sock.on("connect", () => {
      sock.emit("join-classroom-room", { channelName });
    });

    // Student: teacher forced a tab switch
    sock.on("classroom-tab-change", ({ tab }) => {
      if (userRole === "student") {
        setActiveTab(tab);
        setBlinkTab(null); // clear any blink — they're already on the tab
        const labels = { video: "Video", content: "Content", whiteboard: "Board" };
        setTabSyncNotice(`Teacher switched to ${labels[tab] || tab}`);
        clearTimeout(tabSyncTimerRef.current);
        tabSyncTimerRef.current = setTimeout(() => setTabSyncNotice(""), 3000);
      }
    });

    // Student: teacher pinged a tab — make it blink until clicked
    sock.on("classroom-tab-notify", ({ tab }) => {
      if (userRole === "student") {
        setBlinkTab(tab);
      }
    });

    return () => {
      clearTimeout(tabSyncTimerRef.current);
      sock.disconnect();
      classroomSockRef.current = null;
    };
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Teacher: broadcast tab switch to students
  const switchTab = (tab) => {
    setActiveTab(tab);
    if (blinkTab === tab) setBlinkTab(null); // student clicked the blinking tab
    if (userRole === "teacher") {
      classroomSockRef.current?.emit("classroom-tab-change", { channelName, tab });
    }
  };

  // Teacher: ping a tab — makes it blink on student's screen without forcing a switch
  const notifyTab = (tab) => {
    setNotifyOpen(false);
    classroomSockRef.current?.emit("classroom-tab-notify", { channelName, tab });
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!extendOpen) return;
    const handler = (e) => { if (extendRef.current && !extendRef.current.contains(e.target)) setExtendOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [extendOpen]);

  useEffect(() => {
    if (!notifyOpen) return;
    const handler = (e) => { if (notifyRef.current && !notifyRef.current.contains(e.target)) setNotifyOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifyOpen]);

  // Close platform dropdown when clicking outside
  useEffect(() => {
    if (!platformOpen) return;
    const handler = (e) => { if (platformRef.current && !platformRef.current.contains(e.target)) setPlatformOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [platformOpen]);

  // Student: teacher switched to Google Meet — redirect
  useEffect(() => {
    if (userRole !== "student") return;
    if (sessionVideoProvider && sessionVideoProvider !== "agora") {
      minimizeSession();
      navigate("/classroom", { state: { classData, userRole } });
    }
  }, [sessionVideoProvider, userRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Minimize helper — go back to dashboard without ending the session
  const handleMinimize = () => {
    sessionStorage.setItem("activeClass", JSON.stringify({
      bookingId,
      classData,
      userRole,
      platform: "agora",
      minimizedAt: Date.now(),
    }));
    minimizeSession();
    navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
  };

  // Clear saved classroom state when properly ending (not minimizing)
  const clearClassroomState = () => sessionStorage.removeItem("classroomState");

  // Teacher: switch platform
  const handleSwitchPlatform = async (newProvider) => {
    setPlatformSwitching(true);
    try {
      await api.patch(`/classroom/session/${bookingId}/video-provider`, { videoProvider: newProvider });
      if (newProvider === "googlemeet" && googleMeetLink) {
        window.open(googleMeetLink, "_blank");
      }
      minimizeSession();
      // Navigate back to Classroom — it will detect the new provider and load GoogleMeetClassroom
      navigate("/classroom", { state: { classData, userRole } });
    } catch (err) {
      console.error("Platform switch failed:", err);
      setPlatformSwitching(false);
    }
  };

  // ── Agora presence callbacks ───────────────────────────────────────────────
  // These fire in real-time from the SDK — much faster than the DB poll.
  const handleUserJoined = () => {
    console.log("[agora] remote user joined video");
    if (userRole === "teacher") {
      studentPresentRef.current = true;
      setIsStudentPresent(true);
    } else {
      teacherPresentRef.current = true;
      setIsTeacherPresent(true);
    }
  };

  const handleUserLeft = () => {
    console.log("[agora] remote user left video");
    if (userRole === "teacher") {
      studentPresentRef.current = false;
      setIsStudentPresent(false);
    } else {
      teacherPresentRef.current = false;
      setIsTeacherPresent(false);
    }
  };

  // ── Completion / processing screen ────────────────────────────────────────
  if (autoCompleting || completionResult) {
    const isCompleted = completionResult?.completed && !completionResult?.missed;
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${dm ? "bg-gray-900" : "bg-gradient-to-br from-purple-50 to-blue-50"}`}>
        <div className={`rounded-3xl shadow-2xl p-10 max-w-md w-full text-center ${dm ? "bg-gray-800" : "bg-white"}`}>
          {autoCompleting ? (
            <>
              <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h2 className={`text-2xl font-bold mb-2 ${dm ? "text-gray-100" : "text-gray-800"}`}>Processing Class...</h2>
              <p className={dm ? "text-gray-400" : "text-gray-500"}>Calculating attendance and updating records</p>
            </>
          ) : isCompleted ? (
            <>
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-emerald-600" />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${dm ? "text-gray-100" : "text-gray-800"}`}>Class Completed!</h2>
              <p className={`mb-6 ${dm ? "text-gray-300" : "text-gray-600"}`}>{completionResult?.message || "Class successfully recorded."}</p>
              <div className={`rounded-2xl p-4 mb-6 text-sm text-left space-y-2 ${dm ? "bg-emerald-900/40" : "bg-emerald-50"}`}>
                <div className="flex justify-between">
                  <span className={dm ? "text-gray-400" : "text-gray-500"}>Time Together</span>
                  <span className="font-bold text-emerald-700">{formatMinutes(completionResult?.bothActiveTime || bothActiveTime)}</span>
                </div>
                {userRole === "teacher" && completionResult?.teacherEarned != null && (
                  <div className="flex justify-between">
                    <span className={dm ? "text-gray-400" : "text-gray-500"}>Earnings Added</span>
                    <span className="font-bold text-emerald-500">${completionResult.teacherEarned.toFixed(2)}</span>
                  </div>
                )}
                {userRole === "student" && completionResult?.studentClassesRemaining != null && (
                  <div className="flex justify-between">
                    <span className={dm ? "text-gray-400" : "text-gray-500"}>Classes Remaining</span>
                    <span className="font-bold text-emerald-500">{completionResult.studentClassesRemaining}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  clearClassroomState();
                  if (onLeave) onLeave();
                  else navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard",
                    { state: { classCompleted: true, activeTab: "payment" } });
                }}
                className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold transition-all"
              >
                Back to Dashboard
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-orange-600" />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${dm ? "text-gray-100" : "text-gray-800"}`}>Class Not Completed</h2>
              <p className={`mb-4 text-sm ${dm ? "text-gray-300" : "text-gray-600"}`}>{completionResult?.reason || "Attendance requirements were not met."}</p>
              <div className={`border rounded-2xl p-4 mb-6 text-sm text-left space-y-2 ${dm ? "bg-orange-900/30 border-orange-800" : "bg-orange-50 border-orange-200"}`}>
                <div className="flex justify-between">
                  <span className={dm ? "text-gray-400" : "text-gray-500"}>Teacher Joined</span>
                  <span className={`font-bold ${completionResult?.teacherJoined ? "text-emerald-600" : "text-red-600"}`}>
                    {completionResult?.teacherJoined ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={dm ? "text-gray-400" : "text-gray-500"}>Student Joined</span>
                  <span className={`font-bold ${completionResult?.studentJoined ? "text-emerald-500" : "text-red-500"}`}>
                    {completionResult?.studentJoined ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                {completionResult?.bothActiveTime != null && (
                  <div className="flex justify-between">
                    <span className={dm ? "text-gray-400" : "text-gray-500"}>Time Together</span>
                    <span className={`font-bold ${dm ? "text-orange-400" : "text-orange-700"}`}>{formatMinutes(completionResult.bothActiveTime)}</span>
                  </div>
                )}
                {completionResult?.requiredTime != null && (
                  <div className="flex justify-between">
                    <span className={dm ? "text-gray-400" : "text-gray-500"}>Required</span>
                    <span className={`font-bold ${dm ? "text-gray-300" : "text-gray-700"}`}>{formatMinutes(completionResult.requiredTime)}</span>
                  </div>
                )}
              </div>
              <p className={`text-xs mb-4 ${dm ? "text-gray-500" : "text-gray-400"}`}>No class was deducted and no earnings were added.</p>
              {!disputeSubmitted ? (
                !disputeOpen ? (
                  <button onClick={() => setDisputeOpen(true)}
                    className="w-full px-6 py-3 mb-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold transition-all">
                    Request Dispute / Technical Issue
                  </button>
                ) : (
                  <div className={`text-left mb-3 border rounded-2xl p-4 ${dm ? "border-amber-700 bg-amber-900/30" : "border-amber-300 bg-amber-50"}`}>
                    <p className={`font-bold mb-3 text-sm ${dm ? "text-gray-200" : "text-gray-700"}`}>Report an issue for admin review</p>
                    <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none ${dm ? "bg-gray-700 border-gray-600 text-gray-100" : "border-gray-300"}`}>
                      <option value="network_issue">Network / Technical Issue</option>
                      <option value="emergency">Emergency</option>
                      <option value="student_absent">Student Was Absent</option>
                      <option value="insufficient_attendance">Attendance Tracker Error</option>
                      <option value="other">Other</option>
                    </select>
                    <textarea value={disputeDesc} onChange={e => setDisputeDesc(e.target.value)}
                      placeholder="Describe what happened..." rows={3}
                      className={`w-full border rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none resize-none ${dm ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400" : "border-gray-300"}`} />
                    <div className="flex gap-2">
                      <button onClick={() => setDisputeOpen(false)}
                        className={`flex-1 px-4 py-2 rounded-full text-sm font-bold ${dm ? "bg-gray-600 hover:bg-gray-500 text-gray-200" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>
                        Cancel
                      </button>
                      <button disabled={!disputeDesc.trim() || disputeSubmitting}
                        onClick={async () => {
                          setDisputeSubmitting(true);
                          try {
                            await api.post("/classroom/end-early", {
                              bookingId, reason: disputeReason, reportedBy: userRole,
                              description: disputeDesc,
                              bothActiveTime: completionResult?.bothActiveTime || 0,
                              requiredTime: completionResult?.requiredTime || 0,
                              endedAt: new Date().toISOString(), endedBy: userRole,
                            });
                            setDisputeSubmitted(true);
                          } catch (_) {} finally { setDisputeSubmitting(false); }
                        }}
                        className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-full text-sm font-bold">
                        {disputeSubmitting ? "Submitting…" : "Submit"}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className={`mb-3 p-4 border rounded-2xl text-sm font-semibold text-center ${dm ? "bg-emerald-900/30 border-emerald-700 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                  Dispute submitted. An admin will review and may mark the class as completed.
                </div>
              )}
              <button onClick={() => {
                clearClassroomState();
                if (onLeave) onLeave();
                else navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard",
                  { state: { classMissed: true, activeTab: userRole === "teacher" ? "completed-classes" : "dashboard" } });
              }} className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-800 text-white rounded-full font-bold transition-all">
                Back to Dashboard
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Main classroom UI ──────────────────────────────────────────────────────
  return (
    <div className={`h-screen flex flex-col ${dm ? "bg-gray-900" : "bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50"}`}>

      {/* HEADER */}
      <div className={`border-b flex-shrink-0 ${dm ? "bg-gray-900 border-gray-700/60" : "bg-white border-gray-200"}`}
        style={{ boxShadow: dm ? "0 1px 0 rgba(255,255,255,0.04)" : "0 1px 3px rgba(0,0,0,0.06)" }}>

        {/* ── Row 1: back button · title · actions ── */}
        <div className={`flex items-center gap-2 ${isMobile ? "px-3 py-2" : "px-5 py-2.5"}`}>

          {/* Back / Dashboard button — always visible, prominent on mobile */}
          <button onClick={handleMinimize}
            title="Back to dashboard (class stays active)"
            className={`flex-shrink-0 inline-flex items-center justify-center transition-all duration-150 active:scale-95 ${
              isMobile
                ? `w-9 h-9 rounded-xl ${dm ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`
                : `gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${dm ? "border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200 hover:border-gray-600" : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`
            }`}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            {!isMobile && "Dashboard"}
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className={`font-semibold leading-tight truncate ${isMobile ? "text-sm" : "text-base"} ${dm ? "text-gray-100" : "text-gray-900"}`}>
              {classData?.title || "Class"}
            </h1>
            {classData?.topic && !isMobile && (
              <p className={`text-xs truncate ${dm ? "text-gray-500" : "text-gray-400"}`}>{classData.topic}</p>
            )}
          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">

            {/* On mobile: teacher-only extras collapsed into ⋮ menu */}
            {isMobile && userRole === "teacher" && (
              <div className="relative" ref={extendRef}>
                <button onClick={() => { setExtendOpen(o => !o); setExtendMsg(""); setPlatformOpen(false); }}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 ${dm ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                  </svg>
                </button>
                {extendOpen && (
                  <div className={`absolute right-0 top-full mt-1.5 border rounded-xl shadow-2xl p-3 z-50 w-52 ${dm ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
                    style={{ boxShadow: dm ? "0 20px 60px rgba(0,0,0,0.5)" : "0 20px 60px rgba(0,0,0,0.12)" }}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${dm ? "text-gray-500" : "text-gray-400"}`}>Extend duration</p>
                    {extendMsg ? (
                      <p className={`text-xs text-center font-semibold py-1.5 rounded-lg mb-2 ${extendMsg.startsWith("✓") ? dm ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-50 text-emerald-600" : dm ? "bg-red-900/40 text-red-400" : "bg-red-50 text-red-500"}`}>{extendMsg}</p>
                    ) : (
                      <div className="flex gap-1.5 mb-3">
                        {[5, 10, 15].map(mins => (
                          <button key={mins} disabled={extendLoading}
                            onClick={async () => {
                              setExtendLoading(true);
                              try { await handleExtendTime(mins); setExtendMsg(`✓ +${mins} min added`); setTimeout(() => { setExtendOpen(false); setExtendMsg(""); }, 1500); }
                              catch { setExtendMsg("Failed — try again"); }
                              finally { setExtendLoading(false); }
                            }}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${dm ? "bg-emerald-700 hover:bg-emerald-600 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}>
                            +{mins}m
                          </button>
                        ))}
                      </div>
                    )}
                    <div className={`h-px mb-3 ${dm ? "bg-gray-700" : "bg-gray-100"}`} />
                    <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${dm ? "text-gray-500" : "text-gray-400"}`}>Switch platform</p>
                    <button onClick={() => { setExtendOpen(false); handleSwitchPlatform("googlemeet"); }}
                      disabled={!googleMeetLink}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2">
                      Google Meet
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Desktop-only: Platform + Add Time buttons */}
            {!isMobile && userRole === "teacher" && (
              <>
                <div className="relative" ref={platformRef}>
                  <button onClick={() => setPlatformOpen(o => !o)} disabled={platformSwitching}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 active:bg-violet-700 active:scale-95 text-white shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/>
                    </svg>
                    {platformSwitching ? "Switching…" : "Platform"}
                  </button>
                  {platformOpen && (
                    <div className={`absolute right-0 top-full mt-1.5 border rounded-xl shadow-2xl p-3 z-50 w-52 ${dm ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
                      style={{ boxShadow: dm ? "0 20px 60px rgba(0,0,0,0.5)" : "0 20px 60px rgba(0,0,0,0.12)" }}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${dm ? "text-gray-500" : "text-gray-400"}`}>Switch platform</p>
                      <button onClick={() => { setPlatformOpen(false); handleSwitchPlatform("googlemeet"); }}
                        disabled={!googleMeetLink}
                        className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                        </svg>
                        Google Meet
                      </button>
                      {!googleMeetLink && <p className={`text-[11px] text-center mt-2 ${dm ? "text-amber-500" : "text-amber-600"}`}>No Meet link on your profile</p>}
                    </div>
                  )}
                </div>

                <div className="relative" ref={extendRef}>
                  <button onClick={() => { setExtendOpen(o => !o); setExtendMsg(""); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-95 text-white shadow-sm transition-all duration-150">
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add Time
                  </button>
                  {extendOpen && (
                    <div className={`absolute right-0 top-full mt-1.5 border rounded-xl shadow-2xl p-3 z-50 w-52 ${dm ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
                      style={{ boxShadow: dm ? "0 20px 60px rgba(0,0,0,0.5)" : "0 20px 60px rgba(0,0,0,0.12)" }}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${dm ? "text-gray-500" : "text-gray-400"}`}>Extend duration</p>
                      {extendMsg ? (
                        <p className={`text-xs text-center font-semibold py-1.5 rounded-lg ${extendMsg.startsWith("✓") ? dm ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-50 text-emerald-600" : dm ? "bg-red-900/40 text-red-400" : "bg-red-50 text-red-500"}`}>{extendMsg}</p>
                      ) : (
                        <div className="flex gap-1.5">
                          {[5, 10, 15].map(mins => (
                            <button key={mins} disabled={extendLoading}
                              onClick={async () => {
                                setExtendLoading(true);
                                try { await handleExtendTime(mins); setExtendMsg(`✓ +${mins} min added`); setTimeout(() => { setExtendOpen(false); setExtendMsg(""); }, 1500); }
                                catch { setExtendMsg("Failed — try again"); }
                                finally { setExtendLoading(false); }
                              }}
                              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 ${dm ? "bg-emerald-700 hover:bg-emerald-600 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}>
                              +{mins}m
                            </button>
                          ))}
                        </div>
                      )}
                      {extraSeconds > 0 && <p className={`text-[11px] text-center mt-2 ${dm ? "text-gray-500" : "text-gray-400"}`}>+{Math.round(extraSeconds / 60)} min added</p>}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Refresh — icon-only, hidden on mobile to save space */}
            {!isMobile && (
              <button onClick={handleRefresh} title="Refresh presence"
                className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 ${dm ? "text-gray-500 hover:bg-gray-800 hover:text-gray-300" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}>
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            {/* Leave — always visible */}
            <button onClick={() => setShowLeaveModal(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg font-medium bg-red-600 hover:bg-red-500 active:bg-red-700 active:scale-95 text-white shadow-sm transition-all duration-150 ${isMobile ? "w-9 h-9 justify-center" : "px-3 py-1.5 text-xs"}`}
              title="Leave class">
              <Power className="w-3.5 h-3.5 flex-shrink-0" />
              {!isMobile && "Leave"}
            </button>
          </div>
        </div>

        {/* ── Row 2: timer · tabs · presence ── */}
        <div className={`flex items-center justify-between gap-2 border-t ${isMobile ? "px-3 py-1.5" : "px-5 py-2"} ${dm ? "border-gray-800" : "border-gray-100"}`}>

          {/* Timer */}
          <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
            <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${dm ? "text-purple-400" : "text-purple-500"}`} />
            <span className={`font-bold tabular-nums ${isMobile ? "text-base" : "text-lg"} ${timeRemaining < 60 ? "text-red-500 animate-pulse" : dm ? "text-purple-300" : "text-purple-700"}`}>
              {formatTime(timeRemaining)}
            </span>
            {!isMobile && (
              <span className={`text-xs tabular-nums ${dm ? "text-gray-600" : "text-gray-400"}`}>
                {formatTime(timeElapsed)} elapsed
              </span>
            )}
            {!isMobile && classStarted && (
              <div className={`w-24 h-1 rounded-full ml-1 overflow-hidden ${dm ? "bg-gray-700" : "bg-gray-200"}`}>
                <div className={`h-full rounded-full transition-all duration-1000 ${completionPct >= 100 ? "bg-emerald-500" : "bg-purple-500"}`}
                  style={{ width: `${Math.min(completionPct, 100)}%` }} />
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className={`flex items-center rounded-xl p-0.5 ${dm ? "bg-gray-800" : "bg-gray-100"}`}>
              {[
                { id: "video",      Icon: Video,    label: "Video"   },
                { id: "content",    Icon: FileText,  label: "Content" },
                { id: "whiteboard", Icon: PenTool,   label: "Board"   },
              ].map(({ id, Icon, label }) => {
                const isBlinking = blinkTab === id && userRole === "student";
                return (
                  <button key={id} onClick={() => switchTab(id)}
                    className={`relative inline-flex items-center gap-1 rounded-[10px] font-semibold transition-all duration-150 ${isMobile ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-1.5 text-xs"} ${
                      activeTab === id
                        ? dm ? "bg-gray-700 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm"
                        : isBlinking ? "bg-violet-600 text-white shadow-md"
                        : dm ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"
                    } ${isBlinking ? "animate-pulse" : ""}`}>
                    {isBlinking && <span className="absolute inset-0 rounded-[10px] ring-2 ring-violet-400 ring-offset-1 ring-offset-transparent animate-ping pointer-events-none" />}
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {isMobile ? (isBlinking ? "!" : "") : (isBlinking ? "👆" : label)}
                    {isBlinking && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-bounce" />}
                  </button>
                );
              })}
            </div>

            {/* Teacher-only ping — hidden on mobile */}
            {!isMobile && userRole === "teacher" && (
              <div className="relative" ref={notifyRef}>
                <button onClick={() => setNotifyOpen(o => !o)} title="Ping student to switch tab"
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 ${dm ? "bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500" : "bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
                  </svg>
                  Ping
                </button>
                {notifyOpen && (
                  <div className={`absolute right-0 top-full mt-1.5 border rounded-xl shadow-2xl p-3 z-50 w-44 ${dm ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
                    style={{ boxShadow: dm ? "0 20px 60px rgba(0,0,0,0.5)" : "0 20px 60px rgba(0,0,0,0.12)" }}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${dm ? "text-gray-500" : "text-gray-400"}`}>Ping student to…</p>
                    {[
                      { id: "video",      Icon: Video,   label: "Go to Video"   },
                      { id: "content",    Icon: FileText, label: "Go to Content" },
                      { id: "whiteboard", Icon: PenTool,  label: "Go to Board"   },
                    ].map(({ id, Icon, label }) => (
                      <button key={id} onClick={() => notifyTab(id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-1 last:mb-0 transition-all active:scale-95 ${dm ? "hover:bg-gray-700 text-gray-300" : "hover:bg-violet-50 text-gray-700 hover:text-violet-700"}`}>
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />{label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Presence badges */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {[
              { label: isMobile ? "T" : "Teacher", present: isTeacherPresent },
              { label: isMobile ? "S" : "Student", present: isStudentPresent },
            ].map(({ label, present }) => (
              <div key={label} className={`inline-flex items-center gap-1 rounded-lg font-medium border ${isMobile ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} ${
                present
                  ? dm ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : dm ? "bg-gray-800 border-gray-700 text-gray-500" : "bg-gray-50 border-gray-200 text-gray-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${present ? "bg-emerald-500" : dm ? "bg-gray-600" : "bg-gray-300"}`} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WAITING BANNER */}
      {!classStarted && (
        <div className={`border-b px-6 py-1.5 flex items-center justify-center gap-2 text-xs font-medium ${
          dm ? "bg-amber-950/50 border-amber-900/60 text-amber-400" : "bg-amber-50 border-amber-100 text-amber-700"
        }`}>
          <Loader className="w-3 h-3 animate-spin" />
          Waiting for {isTeacherPresent ? "student" : "teacher"} to join before class begins…
        </div>
      )}

      {/* TAB SYNC NOTICE — student only, fades out after 3 s */}
      {tabSyncNotice && (
        <div className={`px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium border-b ${
          dm ? "bg-violet-950/60 border-violet-900/50 text-violet-300" : "bg-violet-50 border-violet-100 text-violet-700"
        }`}>
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          {tabSyncNotice}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden relative">

        {/* VideoCall — must never unmount while active (unmounting calls client.leave()) */}
        <div style={{
          position: "absolute",
          zIndex: activeTab === "video" ? 10 : (isMobile && activeTab === "content") ? 20 : 5,
          ...(activeTab === "video"
            ? { inset: 0 }
            : activeTab === "content"
              ? isMobile
                // Mobile content view: small overlay in bottom-right corner
                ? { right: 8, bottom: 8, width: 100, height: 150, borderRadius: 12, overflow: "hidden" }
                // Desktop content view: sidebar on the right
                : { right: 0, top: 0, bottom: 0, width: "196px" }
              : { inset: 0, visibility: "hidden", pointerEvents: "none" }),
        }}>
          <VideoCall
            key={`video-${bookingId}`}
            channelName={channelName}
            userName={userName}
            onLeave={() => navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard")}
            onUserJoined={handleUserJoined}
            onUserLeft={handleUserLeft}
            mode={activeTab === "video" ? "video" : activeTab === "content" ? "sidebar" : "video"}
            userRole={userRole}
            bookingId={bookingId}
          />
          {activeTab === "video" && userRole === "teacher" && (
            <div className="absolute top-4 left-4 px-4 py-2 bg-white/90 backdrop-blur rounded-lg shadow-lg text-sm font-medium z-50 text-blue-700">
              Agora Video
            </div>
          )}
        </div>

        {/* ContentViewer — always mounted so PDF state (page, zoom, annotations)
             is preserved across tab switches. Hidden via CSS, not unmounted. */}
        <div style={{
          position: "absolute",
          top: 0, bottom: 0, left: 0,
          // Mobile: full width. Desktop: leaves room for sidebar video on right.
          right: (activeTab === "content" && !isMobile) ? "196px" : 0,
          zIndex: activeTab === "content" ? 10 : 1,
          visibility: activeTab === "content" ? "visible" : "hidden",
          pointerEvents: activeTab === "content" ? "auto" : "none",
        }}>
          <ContentViewer bookingId={bookingId} userRole={userRole} channelName={channelName} />
        </div>

        {/* Whiteboard tab */}
        {activeTab === "whiteboard" && (
          <div className="h-full">
            <WhiteboardTab channelName={channelName} userRole={userRole} userId={userId} userName={userName} />
          </div>
        )}
      </div>

      {/* LEAVE MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-6 max-w-sm w-full text-center border ${
            dm ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"
          }`} style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.3)" }}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${dm ? "bg-amber-900/40" : "bg-amber-50"}`}>
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <h2 className={`text-base font-semibold mb-1.5 ${dm ? "text-gray-100" : "text-gray-900"}`}>Leave Early?</h2>
            <p className={`mb-5 text-sm leading-relaxed ${dm ? "text-gray-400" : "text-gray-500"}`}>
              The class will be marked as incomplete if attendance requirements aren't met.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowLeaveModal(false)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all duration-150 active:scale-95 ${
                  dm ? "border-gray-700 text-gray-300 hover:bg-gray-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}>
                <X className="w-3.5 h-3.5" /> Stay
              </button>
              <button onClick={() => { clearClassroomState(); handleLeaveEarly(); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 active:bg-red-700 active:scale-95 text-white transition-all duration-150 shadow-sm">
                <Power className="w-3.5 h-3.5" /> Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
