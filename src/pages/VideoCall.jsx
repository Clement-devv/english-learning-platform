// src/pages/VideoCall.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

// Let Agora handle autoplay-blocked audio automatically (replays on next user gesture)
AgoraRTC.setParameter("AUDIO_VOLUME_INDICATION_INTERVAL", 200);
import api from "../api";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff,
  PhoneOff, Monitor, MonitorOff, Users, Loader, Smile,
} from "lucide-react";

export default function VideoCall({
  channelName,
  userId,
  userName = "User",
  onLeave,
  onUserJoined,
  onUserLeft,
  mode = "video", // "video" | "content" | "whiteboard"
}) {
  const client = useRef(null);
  const [joined,          setJoined]          = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);

  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [screenTrack,     setScreenTrack]     = useState(null);
  const [remoteUsers,     setRemoteUsers]     = useState([]);

  const [micOn,           setMicOn]           = useState(true);
  const [camOn,           setCamOn]           = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmoji,     setActiveEmoji]     = useState(null);

  const localContainer    = useRef(null);
  const remoteContainerRef = useRef({});

  // Prevent duplicate joins
  const isJoiningRef  = useRef(false);
  const hasJoinedRef  = useRef(false);

  // Stable refs for callbacks so event handlers never go stale
  const onUserJoinedRef = useRef(onUserJoined);
  const onUserLeftRef   = useRef(onUserLeft);
  useEffect(() => { onUserJoinedRef.current = onUserJoined; }, [onUserJoined]);
  useEffect(() => { onUserLeftRef.current   = onUserLeft;   }, [onUserLeft]);

  // ── Event handlers (stable — empty deps) ─────────────────────────────────
  const handleUserPublished = useCallback(async (user, mediaType) => {
    console.log(`👤 User ${user.uid} published ${mediaType}`);
    try {
      await client.current.subscribe(user, mediaType);
      console.log(`✅ Subscribed to ${user.uid} / ${mediaType}`);

      if (mediaType === "video") {
        setRemoteUsers(prev => {
          const exists = prev.find(u => u.uid === user.uid);
          if (exists) {
            // User already tracked — still try to replay in case container changed
            return prev.map(u => u.uid === user.uid ? user : u);
          }
          onUserJoinedRef.current?.(user.uid);
          return [...prev, user];
        });
      }

      if (mediaType === "audio") {
        // play() can be silently blocked by browser autoplay policy;
        // Agora's SDK queues it and replays on the next user gesture automatically.
        try { user.audioTrack?.play(); } catch (_) {}
      }
    } catch (err) {
      console.error("❌ Subscribe error:", err);
    }
  }, []);

  const handleUserUnpublished = useCallback((user, mediaType) => {
    console.log(`👤 User ${user.uid} unpublished ${mediaType}`);
    if (mediaType === "video") {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    }
  }, []);

  const handleUserLeft = useCallback((user) => {
    console.log(`👋 User ${user.uid} left`);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    onUserLeftRef.current?.(user.uid);
  }, []);

  const handleConnectionChange = useCallback((cur, prev) => {
    console.log(`🔌 Connection: ${prev} → ${cur}`);
    if (cur === "DISCONNECTED") {
      setError("Connection lost. Please rejoin.");
      setJoined(false);
      hasJoinedRef.current = false;
    }
  }, []);

  // ── Unmount cleanup only — synchronous so it never races with a remount ────
  useEffect(() => {
    return () => {
      console.log("🧹 Unmounting VideoCall — leaving Agora");
      // Capture the ref value at cleanup time to avoid stale closure issues
      const c = client.current;
      if (c) {
        c.removeAllListeners();
        c.leave().catch(() => {});
        client.current = null;
      }
      // Stop and close tracks directly (don't call leaveCall which needs state)
      // Tracks are stored in refs via state — just best-effort close here
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-join on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (!hasJoinedRef.current && !isJoiningRef.current) joinCall();
    }, 300);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FIX: play local video AFTER joined=true causes DOM to render container ─
  useEffect(() => {
    if (!joined || !localVideoTrack) return;
    if (localContainer.current) {
      console.log("▶️ Playing local video track");
      localVideoTrack.play(localContainer.current);
    }
  }, [joined, localVideoTrack]);

  // ── FIX: play remote videos after remoteUsers OR joined changes ─────────────
  // Both deps are needed: remoteUsers changes when a new participant is added,
  // but if they joined BEFORE us, joined=false when remoteUsers first updates,
  // so the container divs don't exist yet. Adding joined means we retry once
  // the local join completes and the containers are finally in the DOM.
  useEffect(() => {
    if (!joined) return;
    remoteUsers.forEach(user => {
      const container = remoteContainerRef.current[user.uid];
      if (container && user.videoTrack) {
        console.log(`▶️ Playing remote video for ${user.uid}`);
        user.videoTrack.play(container);
      }
    });
  }, [remoteUsers, joined]);

  // ── Join ─────────────────────────────────────────────────────────────────
  const joinCall = async () => {
    if (isJoiningRef.current || hasJoinedRef.current) {
      console.log("⚠️ Already joining / joined — skip");
      return;
    }
    try {
      isJoiningRef.current = true;
      setLoading(true);
      setError(null);

      // Create a fresh client each join — avoids any stale state from a previous session
      const newClient = AgoraRTC.createClient({ mode: "rtc", codec: "h264" });
      newClient.on("user-published",        handleUserPublished);
      newClient.on("user-unpublished",      handleUserUnpublished);
      newClient.on("user-left",             handleUserLeft);
      newClient.on("connection-state-change", handleConnectionChange);
      client.current = newClient;

      // Use the real userId — no random suffix (that broke presence tracking)
      const uid = String(userId);
      console.log(`🚀 Joining channel: ${channelName} as uid: ${uid}`);

      const { data } = await api.get(`/api/agora/token?channel=${channelName}&uid=${uid}`);
      if (!data.success) throw new Error(data.message || "Token request failed");

      await client.current.join(data.appId, channelName, data.token, data.uid);
      console.log("✅ Joined channel");

      // 480p_2 + h264 → ~2× faster to start than 720p_2 + vp8
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks({
        audioConfig: {
          encoderConfig: "speech_standard", // leaner than music_standard
          ANS: true, AEC: true, AGC: true,
        },
        videoConfig: {
          encoderConfig: "480p_2",          // fast to encode, upgrade later if needed
          optimizationMode: "motion",       // better for faces / movement
        },
      });

      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      // NOTE: do NOT call videoTrack.play() here — localContainer.current is null
      // because joined=false means the container div isn't in the DOM yet.
      // The useEffect above handles playing once setJoined(true) re-renders the container.

      await client.current.publish([audioTrack, videoTrack]);
      console.log("✅ Published local tracks");

      hasJoinedRef.current = true;
      setJoined(true);

    } catch (err) {
      console.error("❌ Join error:", err);
      let msg = "Failed to join call";
      if (err.code === "INVALID_OPERATION")   msg = "Already connected — please refresh.";
      else if (err.message?.includes("camera") || err.message?.includes("microphone"))
        msg = "Cannot access camera/microphone. Check browser permissions.";
      else if (err.code === "INVALID_TOKEN")  msg = "Session expired — please refresh.";
      else                                    msg = err.message || msg;
      setError(msg);
      hasJoinedRef.current = false;
    } finally {
      setLoading(false);
      isJoiningRef.current = false;
    }
  };

  // ── Leave ─────────────────────────────────────────────────────────────────
  const leaveCall = async () => {
    if (!joined && !hasJoinedRef.current) return;
    try {
      console.log("👋 Leaving call");
      localAudioTrack?.stop(); localAudioTrack?.close();
      localVideoTrack?.stop(); localVideoTrack?.close();
      screenTrack?.stop();     screenTrack?.close();
      if (client.current) await client.current.leave();

      setJoined(false);
      hasJoinedRef.current = false;
      isJoiningRef.current = false;
      setRemoteUsers([]);
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      setScreenTrack(null);
      setIsScreenSharing(false);
      setMicOn(true);
      setCamOn(true);

      onLeave?.();
    } catch (err) {
      console.error("❌ Leave error:", err);
    }
  };

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleMic = async () => {
    if (!localAudioTrack) return;
    const next = !micOn;
    await localAudioTrack.setEnabled(next);
    setMicOn(next);
  };

  const toggleCamera = async () => {
    if (!localVideoTrack) return;
    const next = !camOn;
    await localVideoTrack.setEnabled(next);
    setCamOn(next);
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screen = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: "1080p_1",
          optimizationMode: "detail",
        });
        if (localVideoTrack && camOn) {
          await client.current.unpublish([localVideoTrack]);
          localVideoTrack.stop();
        }
        await client.current.publish([screen]);
        if (localContainer.current) screen.play(localContainer.current);
        setScreenTrack(screen);
        setIsScreenSharing(true);
        screen.on("track-ended", () => toggleScreenShare());
      } else {
        if (screenTrack) {
          await client.current.unpublish([screenTrack]);
          screenTrack.stop();
          screenTrack.close();
          setScreenTrack(null);
        }
        if (localVideoTrack && camOn) {
          await client.current.publish([localVideoTrack]);
          if (localContainer.current) localVideoTrack.play(localContainer.current);
        }
        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error("❌ Screen share error:", err);
      setError("Screen sharing failed. Please try again.");
      setIsScreenSharing(false);
    }
  };

  const emojis = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉", "🤔"];
  const sendEmoji = (emoji) => {
    setActiveEmoji(emoji);
    setShowEmojiPicker(false);
    setTimeout(() => setActiveEmoji(null), 3000);
  };

  // ── Shared video panels ───────────────────────────────────────────────────
  const compact = mode !== "video";

  const LocalPanel = (
    <div className={`flex-1 relative bg-gradient-to-br from-purple-100 to-blue-100 rounded-3xl overflow-hidden shadow-2xl border-4 border-white ${compact ? "min-h-0" : ""}`}>
      {joined ? (
        <>
          {/* FIX: container always in DOM once joined=true, ref is immediately valid */}
          <div ref={localContainer} className="w-full h-full" />

          <div className={`absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg`}>
            <span className={`font-bold text-purple-700 ${compact ? "text-xs" : "text-sm"}`}>{userName} (You)</span>
          </div>

          <div className="absolute top-3 right-3 flex gap-1.5">
            {!micOn && <div className="bg-red-500 p-1.5 rounded-full animate-pulse"><MicOff className={`${compact ? "w-3 h-3" : "w-4 h-4"} text-white`} /></div>}
            {!camOn && <div className="bg-red-500 p-1.5 rounded-full animate-pulse"><VideoOff className={`${compact ? "w-3 h-3" : "w-4 h-4"} text-white`} /></div>}
            {isScreenSharing && <div className="bg-blue-500 p-1.5 rounded-full"><Monitor className={`${compact ? "w-3 h-3" : "w-4 h-4"} text-white`} /></div>}
          </div>

          {activeEmoji && !compact && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className="text-9xl animate-bounce drop-shadow-2xl">{activeEmoji}</span>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center">
          {loading ? (
            <>
              <Loader className={`${compact ? "w-8 h-8" : "w-16 h-16"} text-purple-500 animate-spin mb-3`} />
              <p className={`font-bold text-purple-600 ${compact ? "text-sm" : "text-xl"}`}>Connecting…</p>
              {!compact && <p className="text-sm text-purple-400 mt-1">Starting camera and microphone</p>}
            </>
          ) : (
            <>
              <VideoIcon className={`${compact ? "w-8 h-8" : "w-16 h-16"} text-purple-400 mb-3`} />
              <p className={`font-bold text-purple-600 ${compact ? "text-sm" : "text-xl"}`}>Ready to join</p>
            </>
          )}
        </div>
      )}
    </div>
  );

  const RemotePanel = joined && remoteUsers.length > 0 ? (
    <div className="flex-1 relative bg-gradient-to-br from-pink-100 to-purple-100 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
      {remoteUsers.map(user => (
        <div key={user.uid} className="w-full h-full">
          {/* FIX: ref callback runs synchronously after render, then useEffect plays video */}
          <div
            ref={el => { remoteContainerRef.current[user.uid] = el; }}
            className="w-full h-full"
          />
          <div className={`absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5`}>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className={`font-bold text-purple-700 ${compact ? "text-xs" : "text-sm"}`}>Connected</span>
          </div>
          <div className={`absolute top-3 right-3 bg-green-500 text-white font-bold rounded-full shadow-lg ${compact ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"}`}>
            🔴 LIVE
          </div>
        </div>
      ))}
    </div>
  ) : joined ? (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl border-4 border-dashed border-yellow-300">
      <Users className={`${compact ? "w-12 h-12" : "w-24 h-24"} text-yellow-400 mb-3 animate-pulse`} />
      <p className={`font-bold text-yellow-600 ${compact ? "text-base" : "text-2xl"}`}>Waiting for others…</p>
      {!compact && <p className="text-lg text-yellow-500 mt-1">They'll appear here when they join 🎉</p>}
    </div>
  ) : (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border-4 border-dashed border-gray-300">
      <Users className={`${compact ? "w-12 h-12" : "w-24 h-24"} text-gray-400 mb-3`} />
      <p className={`font-bold text-gray-600 ${compact ? "text-base" : "text-2xl"}`}>Other participant</p>
    </div>
  );

  // ── Full video mode ───────────────────────────────────────────────────────
  if (mode === "video") {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">

        <div className="flex-1 p-4 flex gap-4">
          {LocalPanel}
          {RemotePanel}
        </div>

        {error && (
          <div className="mx-4 mb-2 bg-red-100 border-2 border-red-300 text-red-700 px-4 py-3 rounded-2xl flex items-center justify-between">
            <span className="font-medium">{error}</span>
            <button onClick={() => { setError(null); if (!joined) joinCall(); }} className="text-red-500 hover:text-red-700 font-bold ml-3">
              {joined ? "✕" : "Retry"}
            </button>
          </div>
        )}

        <div className="bg-white border-t-2 border-purple-200 p-4 shadow-lg flex-shrink-0">
          <div className="flex items-center justify-center gap-3">
            {joined && (
              <>
                <button onClick={toggleMic}
                  className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${micOn ? "bg-gradient-to-br from-blue-400 to-blue-500 text-white" : "bg-gradient-to-br from-red-400 to-red-500 text-white animate-pulse"}`}>
                  {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>

                <button onClick={toggleCamera}
                  className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${camOn ? "bg-gradient-to-br from-purple-400 to-purple-500 text-white" : "bg-gradient-to-br from-red-400 to-red-500 text-white animate-pulse"}`}>
                  {camOn ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>

                <button onClick={toggleScreenShare}
                  className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${isScreenSharing ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white" : "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700"}`}>
                  {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                </button>

                <div className="relative">
                  <button onClick={() => setShowEmojiPicker(v => !v)}
                    className="p-4 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-400 hover:from-yellow-400 hover:to-yellow-500 shadow-lg transform hover:scale-110 transition-all">
                    <Smile className="w-6 h-6 text-gray-700" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl p-3 grid grid-cols-4 gap-2 border-2 border-yellow-300 z-50">
                      {emojis.map(e => (
                        <button key={e} onClick={() => sendEmoji(e)}
                          className="text-3xl hover:scale-125 transition-all p-2 hover:bg-yellow-50 rounded-lg">{e}</button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={leaveCall}
                  className="p-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg transform hover:scale-110 transition-all">
                  <PhoneOff className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Compact mode (content / whiteboard) — side-by-side mini panels ────────
  return (
    <div className="h-full flex gap-3 p-3 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {LocalPanel}
      {RemotePanel}
    </div>
  );
}
