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
// AgoraClassroom / GoogleMeetClassroom via the useClassroomCore hook.

import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { getCachedCenter } from "../utils/branding";
import { Video, Loader, XCircle } from "lucide-react";

// Heavy classroom components — loaded only when a provider is actually chosen.
// AgoraClassroom pulls in agora-rtc-sdk-ng (3.4 MB); lazy import keeps it out
// of the initial bundle for users who never enter a classroom.
const AgoraClassroom      = lazy(() => import("./classroom/AgoraClassroom"));
const GoogleMeetClassroom = lazy(() => import("./classroom/GoogleMeetClassroom"));

export default function Classroom({ classData, userRole: propUserRole, onLeave, teacherGoogleMeetLink }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const stateData   = location.state || {};

  const finalClassData = classData || stateData.classData;
  const userRole       = propUserRole || stateData.userRole || localStorage.getItem("role");
  const bookingId      = finalClassData?.bookingId || finalClassData?.id;

  const centerFeatures    = getCachedCenter()?.features || {};
  const agoraEnabled      = centerFeatures.agora       !== false;
  const googleMeetEnabled = centerFeatures.googleMeet  !== false;

  const [activeVideoProvider, setActiveVideoProvider] = useState(null);
  const [resolvedMeetLink,    setResolvedMeetLink]     = useState(
    teacherGoogleMeetLink || finalClassData?.teacherGoogleMeetLink || ""
  );

  // joinConfirmedRef — true once our attendance POST has returned 200.
  // chooseProvider waits on this before patching videoProvider so the session
  // document is guaranteed to exist (avoids 404 on findOneAndUpdate).
  const joinConfirmedRef = useRef(false);

  // ── Fetch Google Meet link if not passed in props ─────────────────────────
  useEffect(() => {
    if (!resolvedMeetLink && bookingId) {
      api.get(`/bookings/${bookingId}`)
        .then(({ data }) => {
          const link = data.booking?.teacherId?.googleMeetLink || "";
          if (link) setResolvedMeetLink(link);
        })
        .catch(() => {});
    }
  }, [bookingId]);

  // ── Ensure the session document exists before teacher picks a platform ────
  useEffect(() => {
    if (!bookingId) return;
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
    if (userRole === "teacher" || activeVideoProvider || !bookingId) return;
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
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-600 mb-2">Cannot Load Classroom</h2>
          <p className="text-gray-600 mb-6">No booking ID found. Please join from your dashboard.</p>
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

  // ── Route to the chosen classroom ─────────────────────────────────────────
  if (activeVideoProvider === "agora") {
    return (
      <Suspense fallback={<ClassroomLoader label="Loading Agora video…" />}>
        <AgoraClassroom
          classData={finalClassData}
          userRole={userRole}
          onLeave={onLeave}
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

  // ── Platform selection (teacher) or waiting screen (student) ──────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-8">

      {userRole === "teacher" ? (

        /* ── Teacher: pick a platform ── */
        <div className="max-w-2xl w-full">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-3">Choose Video Platform</h2>
          <p className="text-center text-gray-600 mb-8">Select which platform to use for this class</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Google Meet */}
            {googleMeetEnabled && (
              <button
                onClick={() => {
                  if (!resolvedMeetLink) {
                    alert("Google Meet link not configured. Please set it in your profile.");
                    return;
                  }
                  window.open(resolvedMeetLink, "_blank");
                  chooseProvider("googlemeet");
                }}
                disabled={!resolvedMeetLink}
                className={`p-8 rounded-2xl border-4 transition-all text-left ${
                  resolvedMeetLink
                    ? "bg-white border-green-300 hover:border-green-500 hover:shadow-xl cursor-pointer"
                    : "bg-gray-100 border-gray-300 cursor-not-allowed opacity-60"
                }`}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${resolvedMeetLink ? "bg-green-500" : "bg-gray-400"}`}>
                    <Video className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Google Meet</h3>
                  <p className="text-sm text-gray-600 text-center mb-3">Opens in a new tab</p>
                  <span className={`px-4 py-1 rounded-full text-xs font-medium ${resolvedMeetLink ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                    {resolvedMeetLink ? "Available" : "Not Configured"}
                  </span>
                </div>
              </button>
            )}

            {/* Agora */}
            {agoraEnabled && (
              <button
                onClick={() => chooseProvider("agora")}
                className="p-8 rounded-2xl border-4 bg-white border-blue-300 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer"
              >
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mb-4">
                    <Video className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Agora Video</h3>
                  <p className="text-sm text-gray-600 text-center mb-3">Embedded in browser</p>
                  <span className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Available</span>
                </div>
              </button>
            )}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            Google Meet uses your personal subscription. Agora is built into the platform.
          </p>
        </div>

      ) : (

        /* ── Student: wait for teacher to choose ── */
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader className="w-10 h-10 text-purple-500 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Waiting for Teacher</h2>
          <p className="text-gray-600">Your teacher is selecting the video platform. This page will update automatically.</p>
        </div>

      )}
    </div>
  );
}

function ClassroomLoader({ label }) {
  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
      gap: "16px",
    }}>
      <div style={{
        width: "44px", height: "44px", borderRadius: "50%",
        border: "4px solid #e0e7ff", borderTopColor: "#7c3aed",
        animation: "classroom-spin 0.75s linear infinite",
      }} />
      <p style={{ fontSize: "15px", fontWeight: "600", color: "#7c3aed", margin: 0 }}>{label}</p>
      <style>{`@keyframes classroom-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
