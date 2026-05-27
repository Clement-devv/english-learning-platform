// ZoomClassroom.jsx
// Full Zoom classroom — attendance, timer, and external-tab monitor.
//
// Architecture is identical to GoogleMeetClassroom — Zoom is an "external tab"
// integration. The platform opens the Zoom link in a new tab, then tracks
// attendance / timer / recording independently using useClassroomCore.
//
// Branding differences from GoogleMeetClassroom:
//   - Zoom blue colour scheme (#2D8CFF)
//   - "Open Zoom" button / "Live in Zoom" labels
//   - Zoom logo icon (custom SVG) instead of Video icon

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ContentViewer from "../ContentViewer";
import WhiteboardTab from "../WhiteboardTab";
import api from "../../api";
import { useClassroomCore } from "./useClassroomCore";
import {
  FileText, PenTool, Clock, Users,
  CheckCircle2, XCircle, Loader, Power, AlertTriangle,
  CheckCircle, X, RefreshCw, Circle, Square,
} from "lucide-react";
import { useRecording } from "../../hooks/useRecording";
import { getCachedBranding } from "../../utils/branding";
import SunshineVideoTab from "./themes/SunshineVideoTab";
import ExplorerVideoTab from "./themes/ExplorerVideoTab";

// Zoom logo mark (Z letter in Zoom's brand blue)
function ZoomIcon({ size = 16, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#2D8CFF" />
      <text x="4" y="18" fontSize="14" fontWeight="900" fontFamily="Arial,sans-serif" fill="#fff">Z</text>
    </svg>
  );
}

export default function ZoomClassroom({ classData, userRole, onLeave, zoomLink }) {
  const navigate    = useNavigate();
  const bookingId   = classData?.bookingId || classData?.id;
  const channelName = `class-${bookingId}`;
  const userName    = localStorage.getItem("name") || "User";
  const userId      = localStorage.getItem("userId") || "";

  const core = useClassroomCore({ bookingId, userRole, duration: classData?.duration });

  const {
    isTeacherPresent, isStudentPresent,
    timeElapsed, bothActiveTime, isTimerRunning, classStarted,
    timeRemaining, completionPct, requiredTime,
    autoCompleting, completionResult,
    showLeaveModal, setShowLeaveModal,
    disputeOpen, setDisputeOpen,
    disputeReason, setDisputeReason,
    disputeDesc, setDisputeDesc,
    disputeSubmitting, setDisputeSubmitting,
    disputeSubmitted, setDisputeSubmitted,
    handleRefresh, handleLeaveEarly,
    formatTime, formatMinutes,
  } = core;

  const [activeTab, setActiveTab] = useState("video");

  // Per-center classroom theme assigned by super admin
  const classroomTheme = getCachedBranding()?.classroomTheme || null;

  const {
    isRecording, uploadingRecording, recSeconds,
    recordingError, setRecordingError,
    startRecording, stopRecording, formatRecTime,
  } = useRecording(bookingId);

  // Auto-open Zoom for the STUDENT only on first load.
  // The teacher already had Zoom opened from the platform selector card click,
  // so we skip the auto-open for teacher to avoid double-opening the same link.
  // Students land here after polling detects "zoom" was chosen and would otherwise
  // have to find and click the Open Zoom button manually.
  // We use a short delay so the page renders first (avoids popup-blocker on some browsers).
  useEffect(() => {
    if (!zoomLink || userRole === "teacher") return;
    const t = setTimeout(() => window.open(zoomLink, "_blank", "noopener,noreferrer"), 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn browser if user tries to close/refresh while recording
  useEffect(() => {
    if (!isRecording && !uploadingRecording) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRecording, uploadingRecording]);

  // ── Completion / processing screen ────────────────────────────────────────
  if (autoCompleting || completionResult) {
    const isCompleted = completionResult?.completed && !completionResult?.missed;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-sky-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          {autoCompleting ? (
            <>
              <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Processing Class...</h2>
              <p className="text-gray-500">Calculating attendance and updating records</p>
            </>
          ) : isCompleted ? (
            <>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Class Completed!</h2>
              <p className="text-gray-600 mb-6">{completionResult?.message || "Class successfully recorded."}</p>
              <div className="bg-blue-50 rounded-2xl p-4 mb-6 text-sm text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Time Together</span>
                  <span className="font-bold text-blue-700">{formatMinutes(completionResult?.bothActiveTime || bothActiveTime)}</span>
                </div>
                {userRole === "teacher" && completionResult?.teacherEarned != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Earnings Added</span>
                    <span className="font-bold text-blue-700">${completionResult.teacherEarned.toFixed(2)}</span>
                  </div>
                )}
                {userRole === "student" && completionResult?.studentClassesRemaining != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Classes Remaining</span>
                    <span className="font-bold text-blue-700">{completionResult.studentClassesRemaining}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (onLeave) onLeave();
                  else navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard",
                    { state: { classCompleted: true, activeTab: "payment" } });
                }}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition-all"
              >
                Back to Dashboard
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Class Not Completed</h2>
              <p className="text-gray-600 mb-4 text-sm">{completionResult?.reason || "Attendance requirements were not met."}</p>
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 text-sm text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Teacher Joined</span>
                  <span className={`font-bold ${completionResult?.teacherJoined ? "text-blue-600" : "text-red-600"}`}>
                    {completionResult?.teacherJoined ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Student Joined</span>
                  <span className={`font-bold ${completionResult?.studentJoined ? "text-blue-600" : "text-red-600"}`}>
                    {completionResult?.studentJoined ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                {completionResult?.bothActiveTime != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time Together</span>
                    <span className="font-bold text-orange-700">{formatMinutes(completionResult.bothActiveTime)}</span>
                  </div>
                )}
                {completionResult?.requiredTime != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Required</span>
                    <span className="font-bold text-gray-700">{formatMinutes(completionResult.requiredTime)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-4">No class was deducted and no earnings were added.</p>
              {!disputeSubmitted ? (
                !disputeOpen ? (
                  <button onClick={() => setDisputeOpen(true)}
                    className="w-full px-6 py-3 mb-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold transition-all">
                    Request Dispute / Technical Issue
                  </button>
                ) : (
                  <div className="text-left mb-3 border border-amber-300 rounded-2xl p-4 bg-amber-50">
                    <p className="font-bold text-gray-700 mb-3 text-sm">Report an issue for admin review</p>
                    <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none">
                      <option value="network_issue">Network / Technical Issue</option>
                      <option value="emergency">Emergency</option>
                      <option value="student_absent">Student Was Absent</option>
                      <option value="insufficient_attendance">Attendance Tracker Error</option>
                      <option value="other">Other</option>
                    </select>
                    <textarea value={disputeDesc} onChange={e => setDisputeDesc(e.target.value)}
                      placeholder="Describe what happened..." rows={3}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setDisputeOpen(false)}
                        className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full text-sm font-bold">
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
                <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-700 font-semibold text-center">
                  Dispute submitted. An admin will review and may mark the class as completed.
                </div>
              )}
              <button onClick={() => {
                if (onLeave) onLeave();
                else navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard",
                  { state: { classMissed: true } });
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">

      {/* HEADER */}
      <div className="bg-white shadow-md border-b-2 border-blue-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold text-gray-800">{classData?.title || "Class"}</h1>
            <p className="text-xs text-gray-500">{classData?.topic || ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full font-semibold text-sm transition-all">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={() => {
                if (isRecording) stopRecording();
                setShowLeaveModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-full font-semibold text-sm transition-all">
              <Power className="w-4 h-4" /> Leave Early
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {/* Timer */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className={`text-xl font-bold ${timeRemaining < 60 ? "text-red-600 animate-pulse" : "text-blue-700"}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <span className="text-xs text-gray-400">elapsed: {formatTime(timeElapsed)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${isTimerRunning ? "bg-blue-500 animate-pulse" : "bg-gray-300"}`} />
              <span className="text-gray-500 font-medium">
                {classStarted ? "In Progress" : "Waiting for both to open classroom..."}
              </span>
              {classStarted && (
                <span className="text-gray-400">
                  · Together: {formatTime(bothActiveTime)} / {formatTime(requiredTime)} ({completionPct}%)
                </span>
              )}
            </div>
            <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-1">
              <div className={`h-full rounded-full transition-all duration-1000 ${completionPct >= 100 ? "bg-blue-600" : "bg-blue-500"}`}
                style={{ width: `${completionPct}%` }} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-100 to-sky-100 rounded-full p-1">
            {["video", "content", "whiteboard"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition-all ${
                  activeTab === tab ? "bg-white shadow-md scale-105 text-blue-600" : "text-blue-400 hover:text-blue-600"
                }`}>
                {tab === "video"      && <ZoomIcon size={14} color={activeTab === tab ? "#2D8CFF" : "#93c5fd"} />}
                {tab === "content"    && <FileText className="w-3.5 h-3.5" />}
                {tab === "whiteboard" && <PenTool  className="w-3.5 h-3.5" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Presence */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-700">
                {(isTeacherPresent ? 1 : 0) + (isStudentPresent ? 1 : 0)}/2
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                {isTeacherPresent ? <CheckCircle2 className="w-3 h-3 text-blue-500" /> : <XCircle className="w-3 h-3 text-gray-300" />}
                <span className="text-gray-500">Teacher</span>
              </div>
              <div className="flex items-center gap-1">
                {isStudentPresent ? <CheckCircle2 className="w-3 h-3 text-blue-500" /> : <XCircle className="w-3 h-3 text-gray-300" />}
                <span className="text-gray-500">Student</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WAITING BANNER */}
      {!classStarted && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-center gap-2 text-sm text-amber-700">
          <Loader className="w-4 h-4 animate-spin" />
          Waiting for {isTeacherPresent ? "student" : "teacher"} to open their classroom page...
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden relative">

        {/* Video tab — themed live class view */}
        {activeTab === "video" && (() => {
          // Shared props for all themed video tab components
          const tabProps = {
            classData, userRole, userName,
            classStarted, isTeacherPresent, isStudentPresent,
            timeRemaining, bothActiveTime, requiredTime, completionPct,
            formatTime,
            // Themes receive googleMeetLink prop but we pass zoomLink here —
            // theme components display it as their "open meeting" link
            googleMeetLink: zoomLink,
            platform: "zoom",
            isRecording, uploadingRecording, recSeconds, recordingError,
            setRecordingError, startRecording, stopRecording, formatRecTime,
          };

          if (classroomTheme === "sunshine") return <SunshineVideoTab {...tabProps} />;
          if (classroomTheme === "explorer") return <ExplorerVideoTab  {...tabProps} />;

          // ── Default: dark professional design (Zoom blue accent) ──────────────
          return (
            <div className="h-full flex flex-col bg-gray-950 relative overflow-hidden">
              <style>{`
                @keyframes zoomSoundWave {
                  0%, 100% { transform: scaleY(0.25); opacity: 0.5; }
                  50%       { transform: scaleY(1);    opacity: 1;   }
                }
              `}</style>

              {/* ── Top bar: LIVE badge · title · timer ── */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-white/5">
                {classStarted ? (
                  <div className="flex items-center gap-1.5 bg-red-600/90 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-xs font-bold tracking-widest">LIVE</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-gray-700/80 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="text-gray-300 text-xs font-bold tracking-wider">WAITING</span>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-white/80 text-sm font-semibold leading-tight">{classData?.title || "Class"}</p>
                  {classData?.topic && <p className="text-white/30 text-xs">{classData.topic}</p>}
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold tabular-nums leading-tight ${timeRemaining < 120 ? "text-red-400 animate-pulse" : "text-white"}`}>
                    {formatTime(timeRemaining)}
                  </p>
                  <p className="text-white/30 text-[10px]">remaining</p>
                </div>
              </div>

              {/* ── Simulated video panels ── */}
              <div className="flex-1 flex gap-3 p-4 min-h-0">
                {[
                  { label: "Teacher", isPresent: isTeacherPresent, isYou: userRole === "teacher" },
                  { label: "Student", isPresent: isStudentPresent, isYou: userRole === "student" },
                ].map(({ label, isPresent, isYou }) => (
                  <div key={label}
                    className={`flex-1 relative rounded-2xl flex flex-col items-center justify-center transition-all duration-700 ${
                      isPresent ? "bg-gray-800 shadow-xl" : "bg-gray-900 border border-white/5"
                    }`}
                    style={isPresent ? { boxShadow: "0 0 0 1.5px rgba(45,140,255,0.4), 0 20px 60px rgba(0,0,0,0.5)" } : {}}
                  >
                    <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm ${
                      isPresent ? "bg-blue-500/20 text-blue-400" : "bg-gray-800/80 text-gray-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPresent ? "bg-blue-400 animate-pulse" : "bg-gray-600"}`} />
                      {isPresent ? "In Zoom" : "Waiting"}
                    </div>
                    {isYou && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 bg-white/10 backdrop-blur-sm rounded-full text-[10px] text-white/50 font-semibold">You</div>
                    )}
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 text-3xl font-black select-none transition-all duration-500 ${
                      isPresent ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gray-800 border-2 border-dashed border-gray-700"
                    }`}
                      style={isPresent ? { boxShadow: "0 0 30px rgba(45,140,255,0.35)" } : {}}>
                      {isPresent ? (isYou ? userName.charAt(0).toUpperCase() : label.charAt(0)) : "?"}
                    </div>
                    <p className={`text-sm font-bold mb-0.5 ${isPresent ? "text-white" : "text-gray-600"}`}>{isYou ? userName : label}</p>
                    <p className="text-xs text-gray-600 mb-4">{isPresent ? "Live in Zoom" : "Not joined yet"}</p>
                    <div className="flex items-end justify-center gap-[3px]" style={{ height: "20px" }}>
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className={`w-[3px] rounded-full origin-bottom ${isPresent && classStarted ? "bg-blue-400" : "bg-gray-700"}`}
                          style={{
                            height: "16px",
                            transform: isPresent && classStarted ? undefined : "scaleY(0.2)",
                            animation: isPresent && classStarted ? `zoomSoundWave ${0.55 + i * 0.09}s ease-in-out ${i * 0.07}s infinite` : "none",
                          }} />
                      ))}
                    </div>
                    {!isPresent && <div className="absolute inset-0 rounded-2xl bg-gray-950/40" />}
                  </div>
                ))}
              </div>

              {/* ── Bottom HUD ── */}
              <div className="flex-shrink-0 px-4 pb-4 flex flex-col gap-2">
                <div className="bg-gray-800/70 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Attendance</span>
                    <span className={`text-sm font-bold tabular-nums ${completionPct >= 100 ? "text-blue-400" : "text-white"}`}>{completionPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2.5">
                    <div className={`h-full rounded-full transition-all duration-1000 ${completionPct >= 100 ? "bg-blue-500" : "bg-blue-500"}`} style={{ width: `${completionPct}%` }} />
                  </div>
                  <div className="grid grid-cols-3 text-center text-xs">
                    <div><p className="text-gray-600">Together</p><p className="text-white font-bold tabular-nums">{formatTime(bothActiveTime)}</p></div>
                    <div><p className="text-gray-600">Required</p><p className="text-white font-bold tabular-nums">{formatTime(requiredTime)}</p></div>
                    <div>
                      <p className="text-gray-600">Remaining</p>
                      <p className={`font-bold tabular-nums ${timeRemaining < 120 ? "text-red-400 animate-pulse" : "text-white"}`}>{formatTime(timeRemaining)}</p>
                    </div>
                  </div>
                </div>
                {!classStarted ? (
                  <div className="flex items-center justify-center gap-2 text-[11px] text-amber-400 bg-amber-500/10 rounded-xl px-4 py-2 border border-amber-500/20">
                    <Loader className="w-3 h-3 animate-spin flex-shrink-0" /> Waiting for both parties to open their classroom pages…
                  </div>
                ) : completionPct >= 100 ? (
                  <div className="flex items-center justify-center gap-2 text-[11px] text-blue-400 bg-blue-500/10 rounded-xl px-4 py-2 border border-blue-500/20">
                    <CheckCircle className="w-3 h-3 flex-shrink-0" /> Attendance requirement met — you can leave safely.
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 bg-white/5 rounded-xl px-4 py-2 border border-white/5">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 text-amber-500" /> Keep this tab open — closing it stops attendance tracking.
                  </div>
                )}
                <div className="flex gap-2">
                  {zoomLink && (
                    <button onClick={() => window.open(zoomLink, "_blank")}
                      className="flex-1 px-4 py-2.5 bg-[#2D8CFF] hover:bg-[#1a7de8] active:bg-[#0d6fd4] text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                      <ZoomIcon size={16} /> Open Zoom
                    </button>
                  )}
                  <button onClick={isRecording ? stopRecording : startRecording} disabled={uploadingRecording}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      uploadingRecording ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                      : isRecording ? "bg-red-600 hover:bg-red-500 text-white ring-1 ring-red-500/50"
                      : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    }`}>
                    {uploadingRecording ? (<><Loader className="w-4 h-4 animate-spin" /> Saving…</>)
                      : isRecording ? (<><Square className="w-3.5 h-3.5 fill-current" /> Stop Rec <span className="font-mono text-xs bg-red-700/80 px-1.5 py-0.5 rounded-md">{formatRecTime(recSeconds)}</span></>)
                      : (<><Circle className="w-3.5 h-3.5" /> Record</>)}
                  </button>
                </div>
                {recordingError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{recordingError}</span>
                    <button onClick={() => setRecordingError(null)} className="ml-auto flex-shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                )}
                {userRole === "teacher" && !zoomLink && (
                  <p className="text-[11px] text-gray-600 text-center">Add a Zoom link to your profile to enable the Open button.</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Content tab */}
        {activeTab === "content" && (
          <div className="h-full">
            <ContentViewer bookingId={bookingId} userRole={userRole} channelName={channelName} />
          </div>
        )}

        {/* Whiteboard tab */}
        {activeTab === "whiteboard" && (
          <div className="h-full">
            <WhiteboardTab channelName={channelName} userRole={userRole} userId={userId} userName={userName} />
          </div>
        )}
      </div>

      {/* LEAVE MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
            {uploadingRecording ? (
              <>
                <Loader className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Saving Recording…</h2>
                <p className="text-gray-500 mb-6 text-sm">
                  Please wait — your recording is being saved. The Leave button will unlock when it's done.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Leave Early?</h2>
                <p className="text-gray-600 mb-6 text-sm">
                  The class will be marked as incomplete if attendance requirements aren't met.
                </p>
              </>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                disabled={uploadingRecording}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 rounded-full font-bold transition-all">
                <X className="w-4 h-4 inline mr-1" /> Stay
              </button>
              <button
                onClick={handleLeaveEarly}
                disabled={uploadingRecording}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full font-bold transition-all">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
