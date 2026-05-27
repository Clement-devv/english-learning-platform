// Classroom.jsx — Platform selector / router
//
// Responsibilities:
//   1. Call joinSession immediately on mount so the DB session exists before the
//      teacher picks a platform (avoids the race condition in chooseProvider).
//   2. Teacher: show platform selection cards → patch videoProvider → route to
//      AgoraClassroom or GoogleMeetClassroom.
//   3. Student: poll for videoProvider every 2 s → show waiting spinner → route
//      to the correct classroom once the teacher has chosen.
//
// All attendance tracking, timer logic, and presence detection live inside
// AgoraClassroom / GoogleMeetClassroom / ZoomClassroom via the useClassroomCore hook.

import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { getCachedCenter } from "../utils/branding";
import { useDarkMode } from "../hooks/useDarkMode";
import { Video, Loader, XCircle } from "lucide-react";

// Heavy classroom components — loaded only when a provider is actually chosen.
// AgoraClassroom pulls in agora-rtc-sdk-ng (3.4 MB); lazy import keeps it out
// of the initial bundle for users who never enter a classroom.
const AgoraClassroom       = lazy(() => import("./classroom/AgoraClassroom"));
const GoogleMeetClassroom  = lazy(() => import("./classroom/GoogleMeetClassroom"));
const ZoomClassroom        = lazy(() => import("./classroom/ZoomClassroom"));
const GroupAgoraClassroom  = lazy(() => import("./classroom/GroupAgoraClassroom"));

export default function Classroom({ classData, userRole: propUserRole, onLeave, teacherGoogleMeetLink }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const stateData   = location.state || {};

  // Restore classData from sessionStorage when location.state is lost on page refresh
  const savedState = (() => {
    try { return JSON.parse(sessionStorage.getItem("classroomState") || "{}"); } catch { return {}; }
  })();

  const finalClassData = classData || stateData.classData || savedState.classData;
  const userRole       = propUserRole || stateData.userRole || savedState.userRole || localStorage.getItem("role");
  const isGroupClass   = !!finalClassData?.isGroupClass;
  const bookingId      = finalClassData?.bookingId || finalClassData?._id || finalClassData?.id;

  const { isDarkMode } = useDarkMode();
  const dm = isDarkMode;

  const centerFeatures    = getCachedCenter()?.features || {};
  const agoraEnabled      = centerFeatures.agora       !== false;
  const googleMeetEnabled = centerFeatures.googleMeet  !== false;
  const zoomEnabled       = centerFeatures.zoom        !== false;

  const [activeVideoProvider, setActiveVideoProvider] = useState(null);
  const [resolvedMeetLink,    setResolvedMeetLink]     = useState(
    teacherGoogleMeetLink || finalClassData?.teacherGoogleMeetLink || ""
  );
  const [resolvedZoomLink, setResolvedZoomLink] = useState(
    finalClassData?.teacherZoomLink || ""
  );
  const [meetLinkLoading, setMeetLinkLoading] = useState(false);

  // Quick-setup: teacher can paste links right in the selector without navigating away
  const [meetDraft,        setMeetDraft]        = useState("");
  const [zoomDraft,        setZoomDraft]        = useState("");
  const [savingMeetLink,   setSavingMeetLink]   = useState(false);
  const [savingZoomLink,   setSavingZoomLink]   = useState(false);
  const [meetSaveError,    setMeetSaveError]    = useState("");
  const [zoomSaveError,    setZoomSaveError]    = useState("");

  const teacherId = (() => {
    try {
      const info = JSON.parse(
        sessionStorage.getItem("teacherInfo") || localStorage.getItem("teacherInfo") || "{}"
      );
      return info._id || info.id || "";
    } catch { return ""; }
  })();

  const saveQuickLink = async (field, value, setSaving, setError, onSuccess) => {
    if (!value.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.patch(`/teachers/${teacherId}/profile`, { [field]: value.trim() });
      onSuccess(value.trim());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save link");
    } finally {
      setSaving(false);
    }
  };

  // joinConfirmedRef — true once our attendance POST has returned 200.
  // chooseProvider waits on this before patching videoProvider so the session
  // document is guaranteed to exist (avoids 404 on findOneAndUpdate).
  const joinConfirmedRef = useRef(false);

  // ── Fetch Google Meet and Zoom links if not passed in props ──────────────
  useEffect(() => {
    if (isGroupClass) return;
    if ((!resolvedMeetLink || !resolvedZoomLink) && bookingId) {
      setMeetLinkLoading(true);
      api.get(`/bookings/${bookingId}`)
        .then(({ data }) => {
          const teacher = data.booking?.teacherId || {};
          if (!resolvedMeetLink) setResolvedMeetLink(teacher.googleMeetLink || "");
          if (!resolvedZoomLink) setResolvedZoomLink(teacher.zoomLink || "");
        })
        .catch(() => {})
        .finally(() => setMeetLinkLoading(false));
    }
  }, [bookingId]);

  // ── Persist classData so page refresh doesn't break the classroom ────────
  useEffect(() => {
    if (finalClassData && userRole) {
      sessionStorage.setItem("classroomState", JSON.stringify({ classData: finalClassData, userRole }));
    }
  }, [bookingId, userRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear minimize banner when classroom actually loads ──────────────────
  useEffect(() => {
    sessionStorage.removeItem("activeClass");
  }, []);

  // ── On mount: pick up existing videoProvider (e.g. after minimize/platform-switch) ─
  useEffect(() => {
    if (isGroupClass || !bookingId) return;
    api.get(`/classroom/session/${bookingId}`)
      .then(({ data }) => {
        if (data?.session?.videoProvider) setActiveVideoProvider(data.session.videoProvider);
      })
      .catch(() => {});
  }, [bookingId]);

  // ── Ensure the session document exists before teacher picks a platform ────
  useEffect(() => {
    if (isGroupClass || !bookingId) return;
    const join = async () => {
      try {
        await api.post("/classroom/attendance", {
          bookingId, userRole, action: "join", timestamp: new Date().toISOString(),
        });
        joinConfirmedRef.current = true;
        console.log("[classroom-selector] session created / confirmed");
      } catch (_) {
        setTimeout(join, 2000);
      }
    };
    join();
  }, [bookingId, userRole]);

  // ── Student: poll for teacher's platform choice ───────────────────────────
  useEffect(() => {
    if (isGroupClass || userRole === "teacher" || activeVideoProvider || !bookingId) return;
    let timeout;
    const poll = async () => {
      try {
        const { data } = await api.get(`/classroom/session/${bookingId}`);
        if (data?.session?.videoProvider) {
          setActiveVideoProvider(data.session.videoProvider);
          return;
        }
      } catch (_) {}
      timeout = setTimeout(poll, 2000);
    };
    timeout = setTimeout(poll, 2000);
    return () => clearTimeout(timeout);
  }, [bookingId, userRole, activeVideoProvider]);

  // ── chooseProvider (teacher only) ────────────────────────────────────────
  const chooseProvider = async (provider) => {
    setActiveVideoProvider(provider);
    if (!bookingId) return;
    // Wait for the session to be confirmed before patching
    if (!joinConfirmedRef.current) {
      await new Promise(resolve => {
        const t     = setTimeout(resolve, 3000);
        const check = setInterval(() => {
          if (joinConfirmedRef.current) { clearInterval(check); clearTimeout(t); resolve(); }
        }, 100);
      });
    }
    try {
      await api.patch(`/classroom/session/${bookingId}/video-provider`, {
        videoProvider: provider,
      });
    } catch (err) {
      console.error("[classroom-selector] failed to set videoProvider:", err);
    }
  };

  // ── Guard: no bookingId ───────────────────────────────────────────────────
  if (!bookingId) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${dm ? "bg-gray-900" : "bg-red-50"}`}>
        <div className={`rounded-3xl shadow-2xl p-8 max-w-md text-center ${dm ? "bg-gray-800" : "bg-white"}`}>
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-500 mb-2">Cannot Load Classroom</h2>
          <p className={`mb-6 ${dm ? "text-gray-300" : "text-gray-600"}`}>No booking ID found. Please join from your dashboard.</p>
          <button
            onClick={() => navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard")}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Group class: go directly to GroupAgoraClassroom, no platform selection ─
  if (isGroupClass) {
    return (
      <Suspense fallback={<ClassroomLoader label="Loading group class…" />}>
        <GroupAgoraClassroom
          classData={finalClassData}
          userRole={userRole}
          onLeave={onLeave}
        />
      </Suspense>
    );
  }

  // ── Route to the chosen classroom ─────────────────────────────────────────
  if (activeVideoProvider === "agora") {
    return (
      <Suspense fallback={<ClassroomLoader label="Loading Agora video…" />}>
        <AgoraClassroom
          classData={finalClassData}
          userRole={userRole}
          onLeave={onLeave}
          googleMeetLink={resolvedMeetLink}
        />
      </Suspense>
    );
  }

  if (activeVideoProvider === "googlemeet") {
    return (
      <Suspense fallback={<ClassroomLoader label="Loading classroom…" />}>
        <GoogleMeetClassroom
          classData={finalClassData}
          userRole={userRole}
          onLeave={onLeave}
          googleMeetLink={resolvedMeetLink}
        />
      </Suspense>
    );
  }

  if (activeVideoProvider === "zoom") {
    return (
      <Suspense fallback={<ClassroomLoader label="Loading Zoom classroom…" />}>
        <ZoomClassroom
          classData={finalClassData}
          userRole={userRole}
          onLeave={onLeave}
          zoomLink={resolvedZoomLink}
        />
      </Suspense>
    );
  }

  // ── Platform selection (teacher) or waiting screen (student) ──────────────
  return (
    <div className={`min-h-screen flex items-center justify-center p-8 ${dm ? "bg-gray-900" : "bg-gradient-to-br from-purple-50 to-blue-50"}`}>

      {userRole === "teacher" ? (

        /* ── Teacher: pick a platform ── */
        <div className="max-w-3xl w-full">
          <h2 className={`text-3xl font-bold text-center mb-3 ${dm ? "text-gray-100" : "text-gray-800"}`}>Choose Video Platform</h2>
          <p className={`text-center mb-8 ${dm ? "text-gray-400" : "text-gray-600"}`}>Select which platform to use for this class</p>
          <div className={`grid gap-6 ${[googleMeetEnabled, zoomEnabled, agoraEnabled].filter(Boolean).length === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>

            {/* Google Meet */}
            {googleMeetEnabled && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (!resolvedMeetLink) return;
                    window.open(resolvedMeetLink, "_blank");
                    chooseProvider("googlemeet");
                  }}
                  disabled={!resolvedMeetLink || meetLinkLoading}
                  className={`p-8 rounded-2xl border-4 transition-all text-left ${
                    meetLinkLoading
                      ? dm ? "bg-gray-800 border-gray-700 cursor-wait opacity-70" : "bg-gray-50 border-gray-200 cursor-wait opacity-70"
                      : resolvedMeetLink
                      ? dm ? "bg-gray-800 border-green-700 hover:border-green-500 hover:shadow-xl cursor-pointer" : "bg-white border-green-300 hover:border-green-500 hover:shadow-xl cursor-pointer"
                      : dm ? "bg-gray-800 border-gray-700 cursor-not-allowed opacity-60" : "bg-gray-100 border-gray-300 cursor-not-allowed opacity-60"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${resolvedMeetLink ? "bg-green-500" : "bg-gray-500"}`}>
                      {meetLinkLoading
                        ? <Loader className="w-10 h-10 text-white animate-spin" />
                        : <Video className="w-10 h-10 text-white" />
                      }
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${dm ? "text-gray-100" : "text-gray-800"}`}>Google Meet</h3>
                    <p className={`text-sm text-center mb-3 ${dm ? "text-gray-400" : "text-gray-600"}`}>Opens in a new tab</p>
                    <span className={`px-4 py-1 rounded-full text-xs font-medium ${
                      meetLinkLoading
                        ? dm ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"
                        : resolvedMeetLink
                        ? dm ? "bg-green-900/50 text-green-400" : "bg-green-100 text-green-700"
                        : dm ? "bg-amber-900/50 text-amber-400" : "bg-amber-100 text-amber-700"
                    }`}>
                      {meetLinkLoading ? "Checking…" : resolvedMeetLink ? "Available" : "Link not set"}
                    </span>
                  </div>
                </button>

                {/* Quick-setup when Meet link is missing */}
                {!meetLinkLoading && !resolvedMeetLink && (
                  <div className={`border rounded-xl px-4 py-3 text-sm ${dm ? "bg-gray-800/80 border-gray-700" : "bg-white border-gray-200"}`}>
                    <p className={`font-semibold mb-2 flex items-center gap-1.5 ${dm ? "text-amber-300" : "text-amber-700"}`}>
                      ⚠️ No Google Meet link — add it here to use Meet:
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={meetDraft}
                        onChange={e => { setMeetDraft(e.target.value); setMeetSaveError(""); }}
                        type="url"
                        placeholder="https://meet.google.com/xxx-xxxx-xxx"
                        className={`flex-1 px-3 py-2 rounded-lg text-sm border outline-none ${dm ? "bg-gray-900 border-gray-600 text-gray-100 placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400"}`}
                        onKeyDown={e => e.key === "Enter" && saveQuickLink("googleMeetLink", meetDraft, setSavingMeetLink, setMeetSaveError, (v) => { setResolvedMeetLink(v); setMeetDraft(""); })}
                      />
                      <button
                        onClick={() => saveQuickLink("googleMeetLink", meetDraft, setSavingMeetLink, setMeetSaveError, (v) => { setResolvedMeetLink(v); setMeetDraft(""); })}
                        disabled={!meetDraft.trim() || savingMeetLink}
                        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all whitespace-nowrap"
                      >
                        {savingMeetLink ? "Saving…" : "Save"}
                      </button>
                    </div>
                    {meetSaveError && <p className="text-red-500 text-xs mt-1.5">{meetSaveError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Zoom */}
            {zoomEnabled && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (!resolvedZoomLink) return;
                    window.open(resolvedZoomLink, "_blank");
                    chooseProvider("zoom");
                  }}
                  disabled={!resolvedZoomLink || meetLinkLoading}
                  className={`p-8 rounded-2xl border-4 transition-all text-left ${
                    meetLinkLoading
                      ? dm ? "bg-gray-800 border-gray-700 cursor-wait opacity-70" : "bg-gray-50 border-gray-200 cursor-wait opacity-70"
                      : resolvedZoomLink
                      ? dm ? "bg-gray-800 border-blue-700 hover:border-blue-500 hover:shadow-xl cursor-pointer" : "bg-white border-blue-300 hover:border-blue-500 hover:shadow-xl cursor-pointer"
                      : dm ? "bg-gray-800 border-gray-700 cursor-not-allowed opacity-60" : "bg-gray-100 border-gray-300 cursor-not-allowed opacity-60"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${resolvedZoomLink ? "bg-[#2D8CFF]" : "bg-gray-500"}`}>
                      {meetLinkLoading
                        ? <Loader className="w-10 h-10 text-white animate-spin" />
                        : <span className="text-white text-3xl font-black leading-none" style={{ fontFamily: "Arial,sans-serif" }}>Z</span>
                      }
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${dm ? "text-gray-100" : "text-gray-800"}`}>Zoom</h3>
                    <p className={`text-sm text-center mb-3 ${dm ? "text-gray-400" : "text-gray-600"}`}>Opens in a new tab</p>
                    <span className={`px-4 py-1 rounded-full text-xs font-medium ${
                      meetLinkLoading
                        ? dm ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"
                        : resolvedZoomLink
                        ? dm ? "bg-blue-900/50 text-blue-400" : "bg-blue-100 text-blue-700"
                        : dm ? "bg-amber-900/50 text-amber-400" : "bg-amber-100 text-amber-700"
                    }`}>
                      {meetLinkLoading ? "Checking…" : resolvedZoomLink ? "Available" : "Link not set"}
                    </span>
                  </div>
                </button>

                {/* Quick-setup when Zoom link is missing */}
                {!meetLinkLoading && !resolvedZoomLink && (
                  <div className={`border rounded-xl px-4 py-3 text-sm ${dm ? "bg-gray-800/80 border-gray-700" : "bg-white border-gray-200"}`}>
                    <p className={`font-semibold mb-2 flex items-center gap-1.5 ${dm ? "text-amber-300" : "text-amber-700"}`}>
                      ⚠️ No Zoom link — add it here to use Zoom:
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={zoomDraft}
                        onChange={e => { setZoomDraft(e.target.value); setZoomSaveError(""); }}
                        type="url"
                        placeholder="https://zoom.us/j/123456789"
                        className={`flex-1 px-3 py-2 rounded-lg text-sm border outline-none ${dm ? "bg-gray-900 border-gray-600 text-gray-100 placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400"}`}
                        onKeyDown={e => e.key === "Enter" && saveQuickLink("zoomLink", zoomDraft, setSavingZoomLink, setZoomSaveError, (v) => { setResolvedZoomLink(v); setZoomDraft(""); })}
                      />
                      <button
                        onClick={() => saveQuickLink("zoomLink", zoomDraft, setSavingZoomLink, setZoomSaveError, (v) => { setResolvedZoomLink(v); setZoomDraft(""); })}
                        disabled={!zoomDraft.trim() || savingZoomLink}
                        className="px-4 py-2 rounded-lg bg-[#2D8CFF] hover:bg-[#1a7de8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all whitespace-nowrap"
                      >
                        {savingZoomLink ? "Saving…" : "Save"}
                      </button>
                    </div>
                    {zoomSaveError && <p className="text-red-500 text-xs mt-1.5">{zoomSaveError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Agora */}
            {agoraEnabled && (
              <button
                onClick={() => chooseProvider("agora")}
                className={`p-8 rounded-2xl border-4 hover:shadow-xl transition-all cursor-pointer ${dm ? "bg-gray-800 border-purple-700 hover:border-purple-500" : "bg-white border-purple-300 hover:border-purple-500"}`}
              >
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mb-4">
                    <Video className="w-10 h-10 text-white" />
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${dm ? "text-gray-100" : "text-gray-800"}`}>Agora Video</h3>
                  <p className={`text-sm text-center mb-3 ${dm ? "text-gray-400" : "text-gray-600"}`}>Embedded in browser</p>
                  <span className={`px-4 py-1 rounded-full text-xs font-medium ${dm ? "bg-purple-900/50 text-purple-400" : "bg-purple-100 text-purple-700"}`}>Available</span>
                </div>
              </button>
            )}
          </div>
          <p className={`text-center text-xs mt-6 ${dm ? "text-gray-500" : "text-gray-400"}`}>
            Google Meet and Zoom use your personal subscriptions. Agora is built into the platform.{" "}
            <button
              onClick={() => navigate("/teacher/dashboard", { state: { activeTab: "profile" } })}
              className={`underline underline-offset-2 transition-colors ${dm ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"}`}
            >
              Manage links in Profile
            </button>
          </p>
        </div>

      ) : (

        /* ── Student: animated waiting screen ── */
        <WaitingForTeacher />

      )}
    </div>
  );
}

// ── Animated waiting screen ───────────────────────────────────────────────────
const TIPS = [
  "💡 Tip: Try to speak as much English as possible today!",
  "🎯 Goal: Focus on pronunciation — say words slowly and clearly.",
  "📚 Fun fact: Learning 5 new words a day = 1,825 words a year!",
  "🌟 Remember: Mistakes are how we learn. Don't be shy!",
  "🚀 Challenge: Use a word you learned last class today!",
  "🎵 Tip: Singing songs in English helps you remember vocabulary!",
];

const FLOATERS = [
  { emoji: "📚", top: "8%",  left: "6%",  size: 38, dur: 3.2, delay: 0    },
  { emoji: "⭐", top: "12%", left: "88%", size: 34, dur: 2.8, delay: 0.5  },
  { emoji: "✏️", top: "72%", left: "5%",  size: 32, dur: 3.5, delay: 1.0  },
  { emoji: "🚀", top: "75%", left: "90%", size: 36, dur: 2.6, delay: 0.3  },
  { emoji: "💡", top: "40%", left: "3%",  size: 30, dur: 4.0, delay: 0.8  },
  { emoji: "🎮", top: "42%", left: "93%", size: 34, dur: 3.1, delay: 1.4  },
  { emoji: "🌈", top: "20%", left: "50%", size: 28, dur: 3.8, delay: 0.2  },
  { emoji: "🎒", top: "82%", left: "48%", size: 32, dur: 2.9, delay: 1.1  },
  { emoji: "🎨", top: "58%", left: "18%", size: 28, dur: 3.4, delay: 0.6  },
  { emoji: "🦋", top: "30%", left: "80%", size: 30, dur: 3.0, delay: 1.7  },
  { emoji: "🌟", top: "88%", left: "20%", size: 26, dur: 3.6, delay: 0.9  },
  { emoji: "🎵", top: "15%", left: "70%", size: 30, dur: 2.7, delay: 1.3  },
];

function WaitingForTeacher() {
  const [tipIdx, setTipIdx] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const tipTimer = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 4000);
    const dotTimer = setInterval(() => setDotCount(d => (d % 3) + 1), 600);
    return () => { clearInterval(tipTimer); clearInterval(dotTimer); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, overflow: "hidden",
      background: "linear-gradient(135deg,#f5f3ff 0%,#ede9fe 40%,#e0f2fe 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <style>{`
        @keyframes wft-float {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          33%      { transform: translateY(-14px) rotate(6deg); }
          66%      { transform: translateY(-7px) rotate(-4deg); }
        }
        @keyframes wft-bob {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes wft-blink {
          0%,90%,100% { scaleY: 1; }
          95%          { transform: scaleY(0.05); }
        }
        @keyframes wft-dot1 { 0%,100%{opacity:.2;transform:scale(0.8)} 33%{opacity:1;transform:scale(1.2)} }
        @keyframes wft-dot2 { 0%,100%{opacity:.2;transform:scale(0.8)} 55%{opacity:1;transform:scale(1.2)} }
        @keyframes wft-dot3 { 0%,100%{opacity:.2;transform:scale(0.8)} 77%{opacity:1;transform:scale(1.2)} }
        @keyframes wft-tip  { 0%{opacity:0;transform:translateY(10px)} 15%,85%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-10px)} }
        @keyframes wft-pulse{ 0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.35)} 50%{box-shadow:0 0 0 16px rgba(139,92,246,0)} }
        @keyframes wft-spin { to{transform:rotate(360deg)} }
        @keyframes wft-eyes { 0%,88%,100%{transform:scaleY(1)} 92%{transform:scaleY(0.08)} }
        @keyframes wft-wave {
          0%{transform:rotate(0deg)} 15%{transform:rotate(20deg)} 30%{transform:rotate(-10deg)}
          45%{transform:rotate(20deg)} 60%{transform:rotate(0deg)} 100%{transform:rotate(0deg)}
        }
      `}</style>

      {/* Floating background items */}
      {FLOATERS.map((f, i) => (
        <div key={i} style={{
          position: "absolute", top: f.top, left: f.left,
          fontSize: f.size, pointerEvents: "none", userSelect: "none",
          animation: `wft-float ${f.dur}s ease-in-out ${f.delay}s infinite`,
          opacity: 0.75,
        }}>
          {f.emoji}
        </div>
      ))}

      {/* Main card */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
        animation: "wft-bob 3.5s ease-in-out infinite",
      }}>

        {/* Kid at computer SVG */}
        <svg viewBox="0 0 220 200" width="260" height="240" style={{ overflow: "visible" }}>
          {/* Floor shadow */}
          <ellipse cx="110" cy="192" rx="72" ry="8" fill="rgba(139,92,246,0.12)" />

          {/* Desk */}
          <rect x="28" y="148" width="164" height="14" rx="5" fill="#c4a882" />
          <rect x="38" y="160" width="11" height="32" rx="4" fill="#b8986a" />
          <rect x="171" y="160" width="11" height="32" rx="4" fill="#b8986a" />

          {/* Laptop base / keyboard */}
          <rect x="56" y="132" width="108" height="18" rx="6" fill="#374151" />
          <rect x="62" y="136" width="96" height="10" rx="3" fill="#4b5563" />
          {/* Keyboard keys (decorative) */}
          {[68,80,92,104,116,128,140].map(x => (
            <rect key={x} x={x} y="138" width="8" height="6" rx="1.5" fill="#6b7280" />
          ))}

          {/* Laptop screen */}
          <rect x="56" y="72" width="108" height="66" rx="8" fill="#1e1b4b" />
          {/* Screen bezel */}
          <rect x="60" y="76" width="100" height="58" rx="5" fill="#111827" />
          {/* Screen glow */}
          <rect x="60" y="76" width="100" height="58" rx="5" fill="url(#screenGlow)" opacity="0.6" />

          {/* Defs */}
          <defs>
            <radialGradient id="screenGlow" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Screen content: pulsing dots */}
          <circle cx="96"  cy="105" r="6" fill="#a78bfa" style={{ animation: "wft-dot1 1.5s ease-in-out infinite" }} />
          <circle cx="110" cy="105" r="6" fill="#818cf8" style={{ animation: "wft-dot2 1.5s ease-in-out infinite" }} />
          <circle cx="124" cy="105" r="6" fill="#6366f1" style={{ animation: "wft-dot3 1.5s ease-in-out infinite" }} />
          {/* Screen text lines */}
          <rect x="72" y="85" width="76" height="5" rx="2.5" fill="#4c1d95" opacity="0.7" />
          <rect x="80" y="94" width="60" height="4" rx="2" fill="#3b0764" opacity="0.5" />

          {/* Laptop hinge */}
          <rect x="56" y="136" width="108" height="5" rx="2" fill="#1f2937" />

          {/* Kid body */}
          <rect x="84" y="118" width="52" height="38" rx="16" fill="#f59e0b" />
          {/* Shirt design */}
          <path d="M 95 126 Q 110 136 125 126" stroke="#d97706" strokeWidth="2" fill="none" />

          {/* Left arm (waving) */}
          <g style={{ transformOrigin: "78px 122px", animation: "wft-wave 2.5s ease-in-out 1s infinite" }}>
            <rect x="54" y="116" width="28" height="13" rx="6.5" fill="#f59e0b" transform="rotate(-20 68 122)" />
            <circle cx="52" cy="127" r="9" fill="#fde68a" />
            {/* Fingers */}
            <ellipse cx="46" cy="121" rx="4" ry="6" fill="#fde68a" transform="rotate(-30 46 121)" />
            <ellipse cx="42" cy="128" rx="4" ry="6" fill="#fde68a" transform="rotate(-50 42 128)" />
          </g>

          {/* Right arm (on keyboard) */}
          <rect x="138" y="118" width="28" height="13" rx="6.5" fill="#f59e0b" transform="rotate(20 152 124)" />
          <circle cx="170" cy="129" r="9" fill="#fde68a" />

          {/* Head */}
          <circle cx="110" cy="82" r="32" fill="#fde68a" />

          {/* Hair */}
          <path d="M 78 76 Q 82 48 110 46 Q 138 48 142 76 Q 130 58 110 58 Q 90 58 78 76 Z" fill="#92400e" />
          {/* Hair tufts */}
          <ellipse cx="102" cy="49" rx="7" ry="10" fill="#92400e" transform="rotate(-15 102 49)" />
          <ellipse cx="118" cy="49" rx="7" ry="10" fill="#92400e" transform="rotate(15 118 49)" />

          {/* Headphones band */}
          <path d="M 80 78 Q 80 50 110 50 Q 140 50 140 78" stroke="#6366f1" strokeWidth="6" fill="none" strokeLinecap="round" />
          {/* Headphone cups */}
          <rect x="72" y="72" width="16" height="20" rx="8" fill="#6366f1" />
          <rect x="132" y="72" width="16" height="20" rx="8" fill="#6366f1" />
          <rect x="75" y="75" width="10" height="14" rx="5" fill="#818cf8" />
          <rect x="135" y="75" width="10" height="14" rx="5" fill="#818cf8" />

          {/* Eyes (blinking) */}
          <g style={{ transformOrigin: "100px 79px", animation: "wft-eyes 3.5s ease-in-out infinite" }}>
            <ellipse cx="100" cy="79" rx="6" ry="7" fill="#1f2937" />
          </g>
          <g style={{ transformOrigin: "120px 79px", animation: "wft-eyes 3.5s ease-in-out 0.1s infinite" }}>
            <ellipse cx="120" cy="79" rx="6" ry="7" fill="#1f2937" />
          </g>
          {/* Eye shine */}
          <circle cx="103" cy="76" r="2.5" fill="white" />
          <circle cx="123" cy="76" r="2.5" fill="white" />

          {/* Smile */}
          <path d="M 97 90 Q 110 102 123 90" stroke="#b45309" strokeWidth="3" fill="none" strokeLinecap="round" />

          {/* Cheeks */}
          <circle cx="88" cy="88" r="9" fill="#fca5a5" opacity="0.45" />
          <circle cx="132" cy="88" r="9" fill="#fca5a5" opacity="0.45" />

          {/* Stars flying out of screen */}
          <text x="170" y="80" fontSize="16" style={{ animation: "wft-float 2.1s ease-in-out 0.3s infinite" }}>✨</text>
          <text x="46"  y="70" fontSize="14" style={{ animation: "wft-float 2.6s ease-in-out 0.8s infinite" }}>⭐</text>
        </svg>

        {/* Title */}
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900, color: "#4c1d95", letterSpacing: "-0.5px" }}>
            Class is starting soon!
          </h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed" }}>Your teacher is getting ready</span>
            <span style={{ display: "inline-flex", gap: 3 }}>
              {[1,2,3].map(n => (
                <span key={n} style={{
                  width: 7, height: 7, borderRadius: "50%", background: "#8b5cf6", display: "inline-block",
                  animation: `wft-dot${n} 1.2s ease-in-out infinite`,
                }} />
              ))}
            </span>
          </div>

          {/* Rotating tips */}
          <div style={{
            maxWidth: 340, margin: "0 auto",
            padding: "12px 20px", borderRadius: 16,
            background: "rgba(139,92,246,0.1)", border: "2px solid rgba(139,92,246,0.2)",
          }}>
            <p key={tipIdx} style={{
              margin: 0, fontSize: 13, fontWeight: 700, color: "#5b21b6",
              animation: "wft-tip 4s ease-in-out forwards",
            }}>
              {TIPS[tipIdx]}
            </p>
          </div>

          <p style={{ margin: "16px 0 0", fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>
            This page updates automatically — no need to refresh!
          </p>
        </div>
      </div>
    </div>
  );
}

function ClassroomLoader({ label }) {
  const dark = localStorage.getItem("darkMode") === "true";
  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: dark ? "#111827" : "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
      gap: "16px",
    }}>
      <div style={{
        width: "44px", height: "44px", borderRadius: "50%",
        border: `4px solid ${dark ? "#374151" : "#e0e7ff"}`, borderTopColor: "#7c3aed",
        animation: "classroom-spin 0.75s linear infinite",
      }} />
      <p style={{ fontSize: "15px", fontWeight: "600", color: dark ? "#a78bfa" : "#7c3aed", margin: 0 }}>{label}</p>
      <style>{`@keyframes classroom-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
