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
import ManagedAttendanceBar from "./ManagedAttendanceBar";
import {
  FileText, PenTool, Clock, Users,
  XCircle, Loader, AlertTriangle,
  CheckCircle, X, RefreshCw, Circle, Square, PhoneOff,
} from "lucide-react";
import { useRecording } from "../../hooks/useRecording";
import { getCachedBranding } from "../../utils/branding";
import SunshineVideoTab from "./themes/SunshineVideoTab";
import ExplorerVideoTab from "./themes/ExplorerVideoTab";
import CtrlBtn from "./CtrlBtn";

// Zoom logo mark (Z letter in Zoom's brand blue)
function ZoomIcon({ size = 16, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#2D8CFF" />
      <text x="4" y="18" fontSize="14" fontWeight="900" fontFamily="Arial,sans-serif" fill="#fff">Z</text>
    </svg>
  );
}

export default function ZoomClassroom({ classData, userRole, onLeave, zoomLink, managedStudent = false }) {
  const navigate    = useNavigate();
  const bookingId   = classData?.bookingId || classData?.id;
  const channelName = `class-${bookingId}`;
  const userName    = localStorage.getItem("name") || "User";
  const userId      = localStorage.getItem("userId") || "";

  const core = useClassroomCore({ bookingId, userRole, duration: classData?.duration, managedStudent: managedStudent && userRole === "teacher" });

  const {
    isTeacherPresent, isStudentPresent,
    bothActiveTime, classStarted,
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50 p-4">
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
  const presentCount = (isTeacherPresent ? 1 : 0) + (isStudentPresent ? 1 : 0);
  const lowTime      = timeRemaining < 120;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50">
      <style>{`
        @keyframes meetBounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes soundWave  { 0%,100% { transform: scaleY(0.25); opacity: .5 } 50% { transform: scaleY(1); opacity: 1 } }
      `}</style>

      {/* ── TOP BAR: title · status · timer · who's here ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <div className="min-w-0 flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-lg shadow-md shadow-pink-300/50 flex-shrink-0">
            🎀
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-gray-800 truncate leading-tight">{classData?.title || "Class"}</h1>
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${classStarted ? "text-rose-600" : "text-gray-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${classStarted ? "bg-rose-500 animate-pulse" : "bg-gray-300"}`} />
              {classStarted ? "Live" : `Waiting for ${isTeacherPresent ? "student" : "teacher"}…`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-sm ${lowTime ? "text-rose-600 animate-pulse" : "text-pink-600"}`}>
            <Clock className="w-4 h-4" />
            <span className="text-sm font-extrabold tabular-nums">{formatTime(timeRemaining)}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-sm text-pink-600" title="Teacher · Student">
            <Users className="w-4 h-4" />
            <span className="text-sm font-extrabold">{presentCount}/2</span>
          </div>
        </div>
      </div>

      {/* MANAGED STUDENT: teacher confirms attendance */}
      {core.managedStudent && (
        <div className="flex-shrink-0 mx-4 sm:mx-6 mb-2 rounded-2xl overflow-hidden shadow-sm">
          <ManagedAttendanceBar core={core} />
        </div>
      )}

      {/* ── MAIN AREA ── */}
      <div className="flex-1 min-h-0 overflow-hidden relative">

        {activeTab === "video" && (() => {
          // Centers with a themed classroom keep their themed view
          const tabProps = {
            classData, userRole, userName,
            classStarted, isTeacherPresent, isStudentPresent,
            timeRemaining, bothActiveTime, requiredTime, completionPct,
            formatTime,
            googleMeetLink: zoomLink, // themes call it googleMeetLink
            platform: "zoom",
            isRecording, uploadingRecording, recSeconds, recordingError,
            setRecordingError, startRecording, stopRecording, formatRecTime,
          };
          if (classroomTheme === "sunshine") return <SunshineVideoTab {...tabProps} />;
          if (classroomTheme === "explorer") return <ExplorerVideoTab  {...tabProps} />;

          // ── Default: simple, bright pink view ──
          return (
            <div className="h-full overflow-y-auto px-4 sm:px-6 pb-4 flex flex-col items-center justify-center gap-4">
              {/* People */}
              <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Teacher", emoji: "👩‍🏫", isPresent: isTeacherPresent, isYou: userRole === "teacher" },
                  { label: "Student", emoji: "🧒",   isPresent: isStudentPresent, isYou: userRole === "student" },
                ].map(({ label, emoji, isPresent, isYou }, i) => (
                  <div key={label}
                    className={`relative rounded-3xl bg-white p-6 flex flex-col items-center text-center transition-all duration-500 ${
                      isPresent ? "shadow-lg shadow-pink-200/70 ring-2 ring-pink-300" : "shadow-sm ring-1 ring-pink-100"
                    }`}>
                    <span className={`absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      isPresent ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isPresent ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                      {isPresent ? "In Zoom" : "Waiting"}
                    </span>
                    {isYou && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-pink-100 text-pink-600 text-[10px] font-bold">You</span>
                    )}

                    <div
                      className={`mt-4 w-20 h-20 rounded-full flex items-center justify-center text-4xl select-none ${
                        isPresent ? "bg-gradient-to-br from-pink-200 to-rose-300" : "bg-pink-50 border-2 border-dashed border-pink-200 grayscale opacity-60"
                      }`}
                      style={isPresent ? { animation: `meetBounce 2.4s ease-in-out ${i * 0.4}s infinite` } : {}}
                    >
                      {emoji}
                    </div>
                    <p className={`mt-3 text-sm font-extrabold ${isPresent ? "text-gray-800" : "text-gray-400"}`}>{isYou ? userName : label}</p>
                    <p className="text-xs text-gray-400">{isPresent ? "Live in Zoom" : "Not joined yet"}</p>

                    <div className="mt-3 flex items-end justify-center gap-[3px]" style={{ height: 16 }}>
                      {[...Array(7)].map((_, k) => (
                        <div key={k} className={`w-[3px] rounded-full origin-bottom ${isPresent && classStarted ? "bg-pink-400" : "bg-pink-100"}`}
                          style={{
                            height: 14,
                            transform: isPresent && classStarted ? undefined : "scaleY(0.25)",
                            animation: isPresent && classStarted ? `soundWave ${0.55 + k * 0.09}s ease-in-out ${k * 0.07}s infinite` : "none",
                          }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Attendance — one slim line */}
              <div className="w-full max-w-3xl rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-pink-100">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-gray-500">
                    Time together <span className="text-gray-800 tabular-nums">{formatTime(bothActiveTime)}</span>
                    <span className="text-gray-400"> / {formatTime(requiredTime)}</span>
                  </span>
                  <span className={`font-extrabold tabular-nums ${completionPct >= 100 ? "text-emerald-600" : "text-pink-600"}`}>{completionPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-pink-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${completionPct >= 100 ? "bg-emerald-400" : "bg-gradient-to-r from-pink-400 to-rose-500"}`}
                    style={{ width: `${completionPct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1.5">
                  {!classStarted ? (
                    <><Loader className="w-3 h-3 animate-spin" /> Waiting for both of you to open this page…</>
                  ) : completionPct >= 100 ? (
                    <><CheckCircle className="w-3 h-3 text-emerald-500" /> All done — you can leave safely.</>
                  ) : (
                    <><AlertTriangle className="w-3 h-3 text-amber-500" /> Keep this tab open so attendance keeps counting.</>
                  )}
                </p>
              </div>

              {userRole === "teacher" && !zoomLink && (
                <p className="text-[11px] text-gray-400 text-center">Add a Zoom link to your profile to enable the Zoom button.</p>
              )}
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

      {/* Recording error — floats above the control bar */}
      {recordingError && (
        <div className="flex-shrink-0 mx-auto mb-2 max-w-lg flex items-start gap-2 rounded-2xl bg-white px-3 py-2 text-xs text-rose-600 shadow-md ring-1 ring-rose-200">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{recordingError}</span>
          <button onClick={() => setRecordingError(null)} className="ml-auto flex-shrink-0" aria-label="Dismiss"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* ── CONTROL BAR (Meet-style small round buttons) ── */}
      <div className="flex-shrink-0 flex justify-center px-3 pb-4 pt-1">
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-lg shadow-pink-200/60 ring-1 ring-pink-100">
          <CtrlBtn label="Class" active={activeTab === "video"} onClick={() => setActiveTab("video")}>
            <Users className="w-5 h-5" />
          </CtrlBtn>
          <CtrlBtn label="Content" active={activeTab === "content"} onClick={() => setActiveTab("content")}>
            <FileText className="w-5 h-5" />
          </CtrlBtn>
          <CtrlBtn label="Whiteboard" active={activeTab === "whiteboard"} onClick={() => setActiveTab("whiteboard")}>
            <PenTool className="w-5 h-5" />
          </CtrlBtn>

          <div className="w-px h-6 bg-pink-100 mx-1" />

          {zoomLink && (
            <CtrlBtn label="Open Zoom" tone="blue" onClick={() => window.open(zoomLink, "_blank")}>
              <ZoomIcon size={20} />
            </CtrlBtn>
          )}
          <CtrlBtn
            label={uploadingRecording ? "Saving recording…" : isRecording ? "Stop recording" : "Record"}
            tone={isRecording ? "red" : "default"}
            wide={isRecording}
            disabled={uploadingRecording}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {uploadingRecording ? <Loader className="w-5 h-5 animate-spin" />
              : isRecording ? (<><Square className="w-3.5 h-3.5 fill-current" /><span className="text-xs font-bold tabular-nums">{formatRecTime(recSeconds)}</span></>)
              : <Circle className="w-5 h-5" />}
          </CtrlBtn>
          <CtrlBtn label="Refresh" onClick={handleRefresh}>
            <RefreshCw className="w-5 h-5" />
          </CtrlBtn>

          <CtrlBtn label="Leave class" tone="red" wide onClick={() => {
            if (isRecording) stopRecording(); // auto-stop → triggers upload before leaving
            setShowLeaveModal(true);
          }}>
            <PhoneOff className="w-5 h-5" />
          </CtrlBtn>
        </div>
      </div>

      {/* LEAVE MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
            {uploadingRecording ? (
              <>
                <Loader className="w-16 h-16 text-pink-500 animate-spin mx-auto mb-4" />
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
                className="flex-1 px-4 py-3 bg-pink-50 hover:bg-pink-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 rounded-full font-bold transition-all">
                <X className="w-4 h-4 inline mr-1" /> Stay
              </button>
              <button
                onClick={handleLeaveEarly}
                disabled={uploadingRecording}
                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full font-bold transition-all">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
