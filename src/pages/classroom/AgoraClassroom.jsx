// AgoraClassroom.jsx
// Full Agora video classroom — attendance, timer, and VideoCall SDK.
//
// Presence model:
//   - Own presence: set to true in useClassroomCore joinSession (DB confirms our join).
//   - Other user presence: set to true by BOTH the poll (DB) AND the Agora SDK callback.
//     Agora fires onUserJoined faster than the DB poll, so it gives real-time detection.
//   - Setting presence to FALSE: ONLY via Agora onUserLeft callback. Poll never forces false.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import VideoCall from "../VideoCall";
import ContentViewer from "../ContentViewer";
import WhiteboardTab from "../WhiteboardTab";
import api from "../../api";
import { useClassroomCore } from "./useClassroomCore";
import {
  Video, FileText, PenTool, Clock, Users,
  CheckCircle2, XCircle, Loader, Power, AlertTriangle,
  CheckCircle, X, RefreshCw,
} from "lucide-react";

export default function AgoraClassroom({ classData, userRole, onLeave }) {
  const navigate    = useNavigate();
  const bookingId   = classData?.bookingId || classData?.id;
  const userName    = localStorage.getItem("name") || "User";
  const channelName = `class-${bookingId}`;

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
    handleRefresh, handleLeaveEarly,
    formatTime, formatMinutes,
  } = core;

  const [activeTab, setActiveTab] = useState("video");

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          {autoCompleting ? (
            <>
              <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Processing Class...</h2>
              <p className="text-gray-500">Calculating attendance and updating records</p>
            </>
          ) : isCompleted ? (
            <>
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Class Completed!</h2>
              <p className="text-gray-600 mb-6">{completionResult?.message || "Class successfully recorded."}</p>
              <div className="bg-emerald-50 rounded-2xl p-4 mb-6 text-sm text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Time Together</span>
                  <span className="font-bold text-emerald-700">{formatMinutes(completionResult?.bothActiveTime || bothActiveTime)}</span>
                </div>
                {userRole === "teacher" && completionResult?.teacherEarned != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Earnings Added</span>
                    <span className="font-bold text-emerald-700">${completionResult.teacherEarned.toFixed(2)}</span>
                  </div>
                )}
                {userRole === "student" && completionResult?.studentClassesRemaining != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Classes Remaining</span>
                    <span className="font-bold text-emerald-700">{completionResult.studentClassesRemaining}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
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
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Class Not Completed</h2>
              <p className="text-gray-600 mb-4 text-sm">{completionResult?.reason || "Attendance requirements were not met."}</p>
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 text-sm text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Teacher Joined</span>
                  <span className={`font-bold ${completionResult?.teacherJoined ? "text-emerald-600" : "text-red-600"}`}>
                    {completionResult?.teacherJoined ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Student Joined</span>
                  <span className={`font-bold ${completionResult?.studentJoined ? "text-emerald-600" : "text-red-600"}`}>
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
                <div className="mb-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-700 font-semibold text-center">
                  Dispute submitted. An admin will review and may mark the class as completed.
                </div>
              )}
              <button onClick={() => {
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">

      {/* HEADER */}
      <div className="bg-white shadow-md border-b-2 border-purple-200 px-6 py-3 flex-shrink-0">
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
            <button onClick={() => setShowLeaveModal(true)}
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
                <Clock className="w-4 h-4 text-purple-600" />
                <span className={`text-xl font-bold ${timeRemaining < 60 ? "text-red-600 animate-pulse" : "text-purple-700"}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <span className="text-xs text-gray-400">elapsed: {formatTime(timeElapsed)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${isTimerRunning ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
              <span className="text-gray-500 font-medium">
                {classStarted ? "In Progress" : "Waiting for both to join..."}
              </span>
              {classStarted && (
                <span className="text-gray-400">
                  · Together: {formatTime(bothActiveTime)} / {formatTime(requiredTime)} ({completionPct}%)
                </span>
              )}
            </div>
            <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-1">
              <div className={`h-full rounded-full transition-all duration-1000 ${completionPct >= 100 ? "bg-emerald-500" : "bg-purple-500"}`}
                style={{ width: `${completionPct}%` }} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full p-1">
            {["video", "content", "whiteboard"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition-all ${
                  activeTab === tab ? "bg-white shadow-md scale-105 text-purple-600" : "text-purple-400 hover:text-purple-600"
                }`}>
                {tab === "video"      && <Video   className="w-3.5 h-3.5" />}
                {tab === "content"    && <FileText className="w-3.5 h-3.5" />}
                {tab === "whiteboard" && <PenTool  className="w-3.5 h-3.5" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Presence */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-bold text-purple-700">
                {(isTeacherPresent ? 1 : 0) + (isStudentPresent ? 1 : 0)}/2
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                {isTeacherPresent ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-gray-300" />}
                <span className="text-gray-500">Teacher</span>
              </div>
              <div className="flex items-center gap-1">
                {isStudentPresent ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-gray-300" />}
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
          Waiting for {isTeacherPresent ? "student" : "teacher"} to join before class begins...
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden relative">

        {/* VideoCall — must never unmount while active (unmounting calls client.leave()) */}
        <div style={{
          position: "absolute",
          zIndex: activeTab === "video" ? 10 : 5,
          ...(activeTab === "video" ? { inset: 0 }
            : activeTab === "content" ? { right: 0, top: 0, bottom: 0, width: "196px" }
            : { inset: 0, visibility: "hidden", pointerEvents: "none" }),
        }}>
          <VideoCall
            key={`video-${bookingId}`}
            channelName={channelName}
            userName={userName}
            onLeave={() => {}}
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

        {/* Content tab */}
        {activeTab === "content" && (
          <div className="h-full" style={{ marginRight: "196px" }}>
            <ContentViewer bookingId={bookingId} userRole={userRole} />
          </div>
        )}

        {/* Whiteboard tab */}
        {activeTab === "whiteboard" && (
          <div className="h-full">
            <WhiteboardTab bookingId={bookingId} userRole={userRole} />
          </div>
        )}
      </div>

      {/* LEAVE MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Leave Early?</h2>
            <p className="text-gray-600 mb-6 text-sm">
              The class will be marked as incomplete if attendance requirements aren't met.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-bold transition-all">
                <X className="w-4 h-4 inline mr-1" /> Stay
              </button>
              <button onClick={handleLeaveEarly}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition-all">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
