// src/pages/VideoCall.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import VirtualBackgroundExtension from "agora-extension-virtual-background";

AgoraRTC.setParameter("AUDIO_VOLUME_INDICATION_INTERVAL", 200);
import api from "../api";
import { useRecording }  from "../hooks/useRecording";
import { useVideoChat }  from "../hooks/useVideoChat";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff,
  PhoneOff, Monitor, MonitorOff, Users, Loader,
  Smile, Layers, Upload, X, MessageSquare, Send, Waves, Circle, Square,
} from "lucide-react";

// ── Virtual background ────────────────────────────────────────────────────────
const vbExtension = new VirtualBackgroundExtension();
let vbCompatible = false;
try {
  vbCompatible = vbExtension.checkCompatibility();
  if (vbCompatible) AgoraRTC.registerExtensions([vbExtension]);
} catch (_) {}

const BLUR_OPTIONS = [
  { id: "blur-1", label: "Light",  degree: 1 },
  { id: "blur-2", label: "Medium", degree: 2 },
  { id: "blur-3", label: "Heavy",  degree: 3 },
];
const COLOR_OPTIONS = [
  { id: "color-#0f172a", label: "Dark Navy",    hex: "#0f172a" },
  { id: "color-#166534", label: "Forest Green", hex: "#166534" },
  { id: "color-#7c3aed", label: "Purple",       hex: "#7c3aed" },
  { id: "color-#0e7490", label: "Ocean Blue",   hex: "#0e7490" },
  { id: "color-#dc2626", label: "Red",          hex: "#dc2626" },
  { id: "color-#d97706", label: "Amber",        hex: "#d97706" },
];
const REACTION_EMOJIS = ["😊","😂","🥰","😍","🤩","😮","👍","❤️","🔥","🎉","👏","🌸","🌺","✨","💯","🦋"];

// ── Control-bar button ────────────────────────────────────────────────────────
// active=true  → neutral glass (default off/on state when not in danger/accent)
// danger=true  → red (muted, cam off)
// accent       → "blue"|"purple"|"indigo"|"yellow"|"teal"|"red"  (feature active)
// hangup       → pill-shaped red end-call button
// pulse        → pulsing ring (recording)
const ACCENT_CLASSES = {
  blue:   "bg-blue-600   hover:bg-blue-500",
  purple: "bg-purple-600 hover:bg-purple-500",
  indigo: "bg-indigo-600 hover:bg-indigo-500",
  yellow: "bg-yellow-500 hover:bg-yellow-400 text-gray-900",
  teal:   "bg-teal-600   hover:bg-teal-500",
  red:    "bg-red-600    hover:bg-red-500",
};

function CtrlBtn({ children, onClick, label, active, danger, accent, hangup, pulse, disabled, title }) {
  const base = "flex flex-col items-center gap-1 focus:outline-none group";
  let inner;

  if (hangup) {
    inner = "w-14 h-12 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-lg";
  } else if (danger) {
    inner = "w-12 h-12 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-md";
  } else if (accent) {
    inner = `w-12 h-12 rounded-2xl active:scale-95 text-white shadow-md ${ACCENT_CLASSES[accent] || "bg-gray-600"}`;
  } else {
    // neutral glass — inactive/default state
    inner = "w-12 h-12 rounded-2xl active:scale-95 text-white";
    inner += active
      ? " bg-white/10 hover:bg-white/20"
      : " bg-white/10 hover:bg-white/20";
  }

  if (pulse) inner += " ring-2 ring-red-500 ring-offset-1 ring-offset-transparent";
  if (disabled) inner += " opacity-50 cursor-wait";

  return (
    <button onClick={onClick} disabled={disabled} title={title} className={base}>
      <div className={`flex items-center justify-center transition-all duration-150 ${inner}`}>
        {children}
      </div>
      <span className="text-[10px] font-medium text-white/50 group-hover:text-white/80 transition-colors leading-none">
        {label}
      </span>
    </button>
  );
}

export default function VideoCall({
  channelName,
  userName = "User",
  onLeave,
  onUserJoined,
  onUserLeft,
  mode = "video",
  userRole = "student",
  bookingId = null,
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
  const [noiseCancel,     setNoiseCancel]     = useState(true);
  const [noiseCancelSupported, setNoiseCancelSupported] = useState(false);
  const [audioBlocked,    setAudioBlocked]    = useState(false); // browser autoplay blocked

  // ── Custom hooks ──────────────────────────────────────────────────────────
  const {
    showChat, setShowChat, chatInput, setChatInput,
    messages, unreadCount, messagesEndRef,
    sendMessage, toggleChat, resetChat,
    floatingEmojis, showEmojiPicker, setShowEmojiPicker, sendEmoji,
  } = useVideoChat(channelName, userName);

  const {
    isRecording, uploadingRecording, recSeconds,
    startRecording, stopRecording, formatRecTime,
  } = useRecording(bookingId);

  // Virtual background
  const vbProcessorRef = useRef(null);
  const [activeBg,    setActiveBg]   = useState("none");
  const [showBgPanel, setShowBgPanel] = useState(false);
  const [bgLoading,   setBgLoading]  = useState(false);

  const uploadInputRef = useRef(null);
  const customBgUrlRef = useRef(null);

  const localContainer       = useRef(null);
  const remoteContainerRef   = useRef({});
  const isJoiningRef         = useRef(false);
  const hasJoinedRef         = useRef(false);
  const isLeavingRef         = useRef(false);  // true during intentional leaveCall()
  const joinedAtRef          = useRef(null);   // timestamp when Agora join succeeded
  const onUserJoinedRef      = useRef(onUserJoined);
  const onUserLeftRef        = useRef(onUserLeft);
  const localAudioTrackRef   = useRef(null);
  const localVideoTrackRef   = useRef(null);
  const screenTrackRef       = useRef(null);
  useEffect(() => { onUserJoinedRef.current    = onUserJoined;    }, [onUserJoined]);
  useEffect(() => { onUserLeftRef.current      = onUserLeft;      }, [onUserLeft]);
  useEffect(() => { localAudioTrackRef.current = localAudioTrack; }, [localAudioTrack]);
  useEffect(() => { localVideoTrackRef.current = localVideoTrack; }, [localVideoTrack]);
  useEffect(() => { screenTrackRef.current     = screenTrack;     }, [screenTrack]);

  // ── MediaPipe body-segmentation blur ─────────────────────────────────────
  // Replaces Agora's VB blur (oval mask) with proper edge-following segmentation.
  // mpPersonCanvas: sharp person only (background alpha'd out)
  // mpOutputCanvas: blurred full frame + sharp person composited on top
  const mpSegRef       = useRef(null);   // SelfieSegmentation instance
  const mpVideoEl      = useRef(null);   // hidden <video> fed from camera track
  const mpPersonCanvas = useRef(null);   // offscreen canvas — person only
  const mpOutputCanvas = useRef(null);   // offscreen canvas — final frame
  const mpRafId        = useRef(null);   // requestAnimationFrame handle
  const mpCustomTrack  = useRef(null);   // custom Agora VideoTrack from canvas stream
  const mpActiveRef    = useRef(false);  // true while MP blur is running
  const mpBlurPx       = useRef(12);     // current blur strength in CSS pixels

  // ── Agora autoplay unlock ─────────────────────────────────────────────────
  // Browsers block audio autoplay until a user gesture. Agora calls this
  // callback when play() is silently blocked — we surface a button to unlock.
  useEffect(() => {
    AgoraRTC.onAudioAutoplayFailed = () => setAudioBlocked(true);
    return () => { AgoraRTC.onAudioAutoplayFailed = null; };
  }, []);

  // ── Document-level audio unlock ───────────────────────────────────────────
  // Any click/tap on the page after joining resumes suspended AudioContext
  // and retries any remote tracks that are subscribed but not playing.
  // This is the most reliable cross-browser fix for the silent-suspend issue.
  const remoteUsersRef = useRef([]);
  useEffect(() => { remoteUsersRef.current = remoteUsers; }, [remoteUsers]);

  // Resumes the browser AudioContext (suspended by autoplay policy) then
  // replays any Agora remote audio tracks that aren't currently playing.
  const resumeAudio = useCallback(async (users) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        if (ctx.state === "suspended") await ctx.resume();
        ctx.close();
      }
    } catch (_) {}
    (users || remoteUsersRef.current).forEach(u => {
      if (u.audioTrack && !u.audioTrack.isPlaying) {
        try { u.audioTrack.play(); } catch (_) {}
      }
    });
  }, []);

  useEffect(() => {
    const tryUnlock = () => {
      const blocked = remoteUsersRef.current.some(u => u.audioTrack && !u.audioTrack.isPlaying);
      if (blocked) {
        resumeAudio();
        setAudioBlocked(false);
      }
    };
    document.addEventListener("click",      tryUnlock);
    document.addEventListener("touchstart", tryUnlock);
    return () => {
      document.removeEventListener("click",      tryUnlock);
      document.removeEventListener("touchstart", tryUnlock);
    };
  }, [resumeAudio]); // eslint-disable-line react-hooks/exhaustive-deps

  // toggleChat from useVideoChat also needs to close showBgPanel — wrap it
  const handleToggleChat = useCallback(() => {
    toggleChat();
    setShowBgPanel(false);
  }, [toggleChat]);

  // ── Agora event handlers ──────────────────────────────────────────────────
  const handleUserPublished = useCallback(async (user, mediaType) => {
    try {
      await client.current.subscribe(user, mediaType);

      if (mediaType === "audio" && user.audioTrack) {
        // Resume AudioContext first (browser autoplay policy), then play track.
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) { const ctx = new AC(); if (ctx.state === "suspended") await ctx.resume(); ctx.close(); }
        } catch (_) {}
        try { user.audioTrack.play(); } catch (_) {}
        // Verify after 600ms — if still not playing, surface "Enable Audio" banner.
        setTimeout(() => {
          if (user.audioTrack && !user.audioTrack.isPlaying) setAudioBlocked(true);
        }, 600);
      }

      setRemoteUsers(prev => {
        const exists = prev.find(u => u.uid === user.uid);
        if (exists) return prev.map(u => u.uid === user.uid ? user : u);
        onUserJoinedRef.current?.(user.uid);
        return [...prev, user];
      });
    } catch (err) { console.error("❌ Subscribe error:", err); }
  }, []);

  const handleUserUnpublished = useCallback((user) => {
    setRemoteUsers(prev => prev.map(u => u.uid === user.uid ? user : u));
  }, []);

  const handleUserLeft = useCallback((user) => {
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    onUserLeftRef.current?.(user.uid);
  }, []);

  const handleConnectionChange = useCallback((cur) => {
    if (cur === "DISCONNECTED") {
      // Suppress the error when we intentionally called leaveCall()
      if (isLeavingRef.current) return;
      setError("Connection lost. Please rejoin.");
      setJoined(false);
      hasJoinedRef.current = false;
    }
  }, []);

  // ── Unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      localAudioTrackRef.current?.stop();  localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.stop();  localVideoTrackRef.current?.close();
      screenTrackRef.current?.stop();      screenTrackRef.current?.close();
      // MediaPipe sync teardown (can't await here)
      mpActiveRef.current = false;
      cancelAnimationFrame(mpRafId.current);
      if (mpSegRef.current)      { try { mpSegRef.current.close();              } catch (_) {} mpSegRef.current = null; }
      if (mpVideoEl.current)     { mpVideoEl.current.srcObject = null;           mpVideoEl.current = null; }
      if (mpCustomTrack.current) { try { mpCustomTrack.current.stop(); mpCustomTrack.current.close(); } catch (_) {} mpCustomTrack.current = null; }
      const c = client.current;
      if (c) { c.removeAllListeners(); c.leave().catch(() => {}); client.current = null; }
      if (vbProcessorRef.current) { vbProcessorRef.current.release().catch(() => {}); vbProcessorRef.current = null; }
      if (customBgUrlRef.current) { URL.revokeObjectURL(customBgUrlRef.current); customBgUrlRef.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-join ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (!hasJoinedRef.current && !isJoiningRef.current) joinCall();
    }, 300);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play local video ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!joined || !localVideoTrack) return;
    if (localContainer.current) localVideoTrack.play(localContainer.current);
  }, [joined, localVideoTrack, mode]);

  // ── Play remote videos ────────────────────────────────────────────────────
  useEffect(() => {
    if (!joined) return;
    remoteUsers.forEach(user => {
      const container = remoteContainerRef.current[user.uid];
      if (container && user.videoTrack) user.videoTrack.play(container);
      // Re-play audio on every state update — ensures audio plays after
      // autoplay unlock and after reconnects.
      if (user.audioTrack && !user.audioTrack.isPlaying) {
        resumeAudio([user]);
      }
    });
  }, [remoteUsers, joined, mode, resumeAudio]);

  // ── Join ──────────────────────────────────────────────────────────────────
  const joinCall = async () => {
    if (isJoiningRef.current || hasJoinedRef.current) return;
    let channelJoined = false;
    try {
      isJoiningRef.current = true;
      setLoading(true);
      setError(null);

      const newClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      newClient.on("user-published",          handleUserPublished);
      newClient.on("user-unpublished",        handleUserUnpublished);
      newClient.on("user-left",               handleUserLeft);
      newClient.on("connection-state-change", handleConnectionChange);
      client.current = newClient;

      const { data } = await api.get(`/agora/token?channel=${channelName}`);
      if (!data.success) throw new Error(data.message || "Token request failed");

      await client.current.join(data.appId, channelName, data.token, null);
      channelJoined = true;
      hasJoinedRef.current = true;
      joinedAtRef.current  = Date.now();
      setJoined(true);

      // Server-side Agora session tracking — teacher only (prevents double-counting)
      if (userRole === 'teacher' && bookingId) {
        api.post('/agora-usage/start', { channelName, bookingId }).catch(() => {});
      }

      // Create audio and video tracks independently so one failure doesn't kill both.
      let audioTrack = null;
      let videoTrack = null;

      try {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
      } catch (err) {
        console.warn("⚠️ Microphone unavailable:", err.message);
      }

      try {
        videoTrack = await AgoraRTC.createCameraVideoTrack({ encoderConfig: "480p_2", optimizationMode: "motion" });
      } catch (err) {
        console.warn("⚠️ Camera unavailable:", err.message);
      }

      if (!audioTrack && !videoTrack) {
        throw new Error("Cannot access camera or microphone. Check browser permissions.");
      }

      if (videoTrack && vbCompatible) {
        try {
          const processor = vbExtension.createProcessor();
          await processor.init();
          videoTrack.pipe(processor).pipe(videoTrack.processorDestination);
          vbProcessorRef.current = processor;
          setActiveBg("none");
        } catch (vbErr) { console.warn("⚠️ VB init failed:", vbErr); }
      }

      // Apply browser-native noise suppression (Chrome, Edge, Firefox)
      if (audioTrack) {
        try {
          const msTrack = audioTrack.getMediaStreamTrack();
          await msTrack.applyConstraints({ noiseSuppression: true, autoGainControl: true, echoCancellation: true });
          setNoiseCancelSupported(true);
        } catch (_) { /* browser doesn't support applyConstraints — button stays hidden */ }
      }

      if (audioTrack) setLocalAudioTrack(audioTrack);
      if (videoTrack) setLocalVideoTrack(videoTrack);
      const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
      await client.current.publish(tracksToPublish);
    } catch (err) {
      console.error("❌ Join error:", err);
      let msg = "Failed to join call";
      if (err.code === "INVALID_OPERATION") msg = "Already connected — please refresh.";
      else if (err.message?.includes("camera") || err.message?.includes("microphone"))
        msg = "Cannot access camera/microphone. Check browser permissions.";
      else if (err.code === "INVALID_TOKEN") msg = "Session expired — please refresh.";
      else msg = err.message || msg;
      setError(msg);
      if (channelJoined) { client.current?.leave().catch(() => {}); setJoined(false); }
      hasJoinedRef.current = false;
    } finally {
      setLoading(false);
      isJoiningRef.current = false;
    }
  };

  // ── Leave ─────────────────────────────────────────────────────────────────
  const leaveCall = async () => {
    if (!joined && !hasJoinedRef.current) return;
    isLeavingRef.current = true;

    // Agora session tracking — teacher calls /end (server calculates duration server-side)
    if (joinedAtRef.current) {
      joinedAtRef.current = null;
      if (userRole === 'teacher' && bookingId) {
        api.post('/agora-usage/end', { bookingId }).catch(() => {});
      }
    }

    try {
      if (mpActiveRef.current) await stopMPBlur();
      localAudioTrack?.stop(); localAudioTrack?.close();
      localVideoTrack?.stop(); localVideoTrack?.close();
      screenTrack?.stop();     screenTrack?.close();
      if (client.current) await client.current.leave();
      if (vbProcessorRef.current) { try { await vbProcessorRef.current.release(); } catch (_) {} vbProcessorRef.current = null; }
      if (customBgUrlRef.current) { URL.revokeObjectURL(customBgUrlRef.current); customBgUrlRef.current = null; }
      setJoined(false);
      hasJoinedRef.current = false;
      isJoiningRef.current = false;
      setRemoteUsers([]);
      setLocalAudioTrack(null); setLocalVideoTrack(null); setScreenTrack(null);
      setIsScreenSharing(false);
      setMicOn(true); setCamOn(true);
      setActiveBg("none"); setShowBgPanel(false);
      resetChat();
      onLeave?.();
    } catch (err) {
      console.error("❌ Leave error:", err);
    } finally {
      isLeavingRef.current = false;
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
  const toggleNoiseCancel = async () => {
    if (!localAudioTrack) return;
    try {
      const msTrack = localAudioTrack.getMediaStreamTrack();
      const next = !noiseCancel;
      await msTrack.applyConstraints({ noiseSuppression: next, autoGainControl: next, echoCancellation: next });
      setNoiseCancel(next);
    } catch (err) { console.error("Noise cancel toggle failed:", err); }
  };
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Stop MediaPipe blur first — it holds a reference to the camera track
        if (mpActiveRef.current) { await stopMPBlur(); setActiveBg("none"); }
        const screen = await AgoraRTC.createScreenVideoTrack({ encoderConfig: "1080p_1", optimizationMode: "detail" });
        if (localVideoTrack && camOn) { await client.current.unpublish([localVideoTrack]); localVideoTrack.stop(); }
        await client.current.publish([screen]);
        if (localContainer.current) screen.play(localContainer.current);
        setScreenTrack(screen); setIsScreenSharing(true);
        screen.on("track-ended", () => toggleScreenShare());
      } else {
        if (screenTrack) { await client.current.unpublish([screenTrack]); screenTrack.stop(); screenTrack.close(); setScreenTrack(null); }
        if (localVideoTrack && camOn) { await client.current.publish([localVideoTrack]); if (localContainer.current) localVideoTrack.play(localContainer.current); }
        setIsScreenSharing(false);
      }
    } catch (err) { console.error("❌ Screen share error:", err); setError("Screen sharing failed."); setIsScreenSharing(false); }
  };

  // ── MediaPipe background blur ─────────────────────────────────────────────
  // Loads the SelfieSegmentation script once from CDN on first use.
  const loadMPScript = () => new Promise((res, rej) => {
    if (window.SelfieSegmentation) { res(); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/selfie_segmentation.js";
    s.crossOrigin = "anonymous";
    s.onload = res;
    s.onerror = () => rej(new Error("MediaPipe CDN unavailable"));
    document.head.appendChild(s);
  });

  // Stop MediaPipe blur and restore original camera track publishing.
  const stopMPBlur = useCallback(async () => {
    if (!mpActiveRef.current) return;
    mpActiveRef.current = false;
    cancelAnimationFrame(mpRafId.current); mpRafId.current = null;

    if (mpSegRef.current) {
      try { mpSegRef.current.close(); } catch (_) {}
      mpSegRef.current = null;
    }
    if (mpVideoEl.current) { mpVideoEl.current.srcObject = null; mpVideoEl.current = null; }
    mpPersonCanvas.current = null;
    mpOutputCanvas.current = null;

    const custom  = mpCustomTrack.current; mpCustomTrack.current = null;
    const camTrk  = localVideoTrackRef.current;

    if (client.current && camTrk) {
      try {
        if (custom) await client.current.unpublish([custom]);
        await client.current.publish([camTrk]);
      } catch (_) {}
    }
    if (custom) { try { custom.stop(); custom.close(); } catch (_) {} }
    if (localContainer.current && camTrk) camTrk.play(localContainer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start MediaPipe blur: segmenter → canvas compositor → custom Agora track.
  const startMPBlur = useCallback(async (degree) => {
    const camTrk = localVideoTrackRef.current;
    if (!camTrk) return false;

    const BLUR_MAP = { 1: 6, 2: 12, 3: 22 };
    mpBlurPx.current = BLUR_MAP[degree] || 12;

    try {
      await loadMPScript();

      const msTrack = camTrk.getMediaStreamTrack();
      const { width: W = 640, height: H = 480 } = msTrack.getSettings();

      // Hidden video element fed from the live camera MediaStreamTrack
      const vid = document.createElement("video");
      vid.srcObject = new MediaStream([msTrack]);
      vid.width = W; vid.height = H;
      vid.autoplay = true; vid.muted = true; vid.playsInline = true;
      mpVideoEl.current = vid;
      await vid.play().catch(() => {});

      // Canvas A — sharp person cutout
      const personC  = document.createElement("canvas");
      personC.width  = W; personC.height = H;
      const ctxP     = personC.getContext("2d");
      mpPersonCanvas.current = personC;

      // Canvas B — final composited output (captured as Agora custom track)
      const outC   = document.createElement("canvas");
      outC.width   = W; outC.height = H;
      const ctxOut = outC.getContext("2d");
      mpOutputCanvas.current = outC;

      // MediaPipe SelfieSegmentation — model 1 = landscape (higher quality)
      const seg = new window.SelfieSegmentation({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${f}`,
      });
      seg.setOptions({ modelSelection: 1, selfieMode: false });

      seg.onResults(({ image, segmentationMask }) => {
        if (!mpActiveRef.current) return;
        const px = mpBlurPx.current;

        // Step 1 — Extract sharp person: draw full frame, then mask out bg
        ctxP.clearRect(0, 0, W, H);
        ctxP.drawImage(image, 0, 0, W, H);
        ctxP.globalCompositeOperation = "destination-in";  // keep only where mask=white
        ctxP.drawImage(segmentationMask, 0, 0, W, H);
        ctxP.globalCompositeOperation = "source-over";

        // Step 2 — Draw blurred full frame as background
        ctxOut.filter = `blur(${px}px)`;
        ctxOut.drawImage(image, 0, 0, W, H);
        ctxOut.filter = "none";

        // Step 3 — Composite sharp person on top of blurred background
        ctxOut.drawImage(personC, 0, 0, W, H);
      });

      await seg.initialize();
      mpSegRef.current = seg;
      mpActiveRef.current = true;

      // RAF loop — send each video frame to the segmenter
      const tick = async () => {
        if (!mpActiveRef.current) return;
        if (vid.readyState >= 2) await seg.send({ image: vid }).catch(() => {});
        mpRafId.current = requestAnimationFrame(tick);
      };
      mpRafId.current = requestAnimationFrame(tick);

      // Wrap canvas stream as a custom Agora VideoTrack
      const stream    = outC.captureStream(25);
      const customTrk = await AgoraRTC.createCustomVideoTrack({
        mediaStreamTrack: stream.getVideoTracks()[0],
        optimizationMode: "motion",
      });
      mpCustomTrack.current = customTrk;

      // Swap published track: unpublish raw camera, publish composited canvas
      if (client.current) {
        await client.current.unpublish([camTrk]);
        await client.current.publish([customTrk]);
      }
      if (localContainer.current) customTrk.play(localContainer.current);

      return true;
    } catch (err) {
      console.error("❌ MediaPipe blur failed:", err);
      mpActiveRef.current = false;
      return false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Virtual background ────────────────────────────────────────────────────
  const applyBackground = useCallback(async (bgKey) => {
    const processor = vbProcessorRef.current;
    setBgLoading(true);
    try {
      if (bgKey === "none") {
        if (mpActiveRef.current) await stopMPBlur();
        if (processor) await processor.disable();
      } else if (bgKey.startsWith("blur-")) {
        // Always stop any prior MP session first (degree might have changed)
        if (mpActiveRef.current) await stopMPBlur();
        if (processor) { try { await processor.disable(); } catch (_) {} }
        const degree = parseInt(bgKey.split("-")[1]);
        // Try MediaPipe (proper body-contour segmentation); fall back to Agora VB
        const ok = joined ? await startMPBlur(degree) : false;
        if (!ok && processor) {
          processor.setOptions({ type: "blur", blurDegree: degree });
          await processor.enable();
        }
      } else if (bgKey.startsWith("color-")) {
        if (mpActiveRef.current) await stopMPBlur();
        if (processor) { processor.setOptions({ type: "color", color: bgKey.slice(6) }); await processor.enable(); }
      } else if (bgKey.startsWith("img-")) {
        if (mpActiveRef.current) await stopMPBlur();
        if (processor) {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = bgKey.slice(4); });
          processor.setOptions({ type: "img", source: img, fit: "cover" });
          await processor.enable();
        }
      }
      setActiveBg(bgKey);
    } catch (e) { console.error("❌ VB error:", e); }
    finally     { setBgLoading(false); }
  }, [joined, startMPBlur, stopMPBlur]);

  const handleBgUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customBgUrlRef.current) URL.revokeObjectURL(customBgUrlRef.current);
    const url = URL.createObjectURL(file);
    customBgUrlRef.current = url;
    await applyBackground(`img-${url}`);
    e.target.value = "";
  }, [applyBackground]);

  // ── Shared video panels ───────────────────────────────────────────────────
  const compact = mode !== "video";

  const LocalPanel = (
    <div className={`flex-1 relative bg-gray-800 rounded-2xl overflow-hidden shadow-2xl ${compact ? "min-h-0" : ""}`}>
      {joined ? (
        <>
          <div ref={localContainer} className="w-full h-full" />
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
            <span className={`font-medium text-white/90 ${compact ? "text-xs" : "text-sm"}`}>{userName} (You)</span>
          </div>
          <div className="absolute top-3 right-3 flex gap-1.5">
            {!micOn          && <div className="bg-red-500 p-1.5 rounded-full animate-pulse"><MicOff   className={`${compact ? "w-3 h-3" : "w-4 h-4"} text-white`} /></div>}
            {!camOn          && <div className="bg-red-500 p-1.5 rounded-full animate-pulse"><VideoOff className={`${compact ? "w-3 h-3" : "w-4 h-4"} text-white`} /></div>}
            {isScreenSharing && <div className="bg-blue-500 p-1.5 rounded-full"><Monitor className={`${compact ? "w-3 h-3" : "w-4 h-4"} text-white`} /></div>}
            {activeBg !== "none" && !compact && <div className="bg-purple-500 p-1.5 rounded-full" title="Virtual background active"><Layers className="w-4 h-4 text-white" /></div>}
          </div>
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
    <div className="flex-1 relative bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
      {remoteUsers.map(user => (
        <div key={user.uid} className="w-full h-full relative">
          <div ref={el => { remoteContainerRef.current[user.uid] = el; }} className="w-full h-full" />
          {!user.videoTrack && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
              <div className={`${compact ? "w-14 h-14" : "w-20 h-20"} rounded-full bg-white/10 flex items-center justify-center mb-3`}>
                <Users className={`${compact ? "w-7 h-7" : "w-10 h-10"} text-white/40`} />
              </div>
              <p className={`text-white/40 font-medium ${compact ? "text-xs" : "text-sm"}`}>Camera off</p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className={`font-medium text-white/90 ${compact ? "text-xs" : "text-sm"}`}>Connected</span>
          </div>
          <div className={`absolute top-3 right-3 bg-red-600/90 backdrop-blur-sm text-white font-semibold rounded-lg shadow-lg flex items-center gap-1.5 ${compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        </div>
      ))}
    </div>
  ) : joined ? (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 rounded-2xl border border-dashed border-white/10">
      <div className={`${compact ? "w-12 h-12" : "w-20 h-20"} rounded-full bg-white/5 flex items-center justify-center mb-3`}>
        <Users className={`${compact ? "w-6 h-6" : "w-10 h-10"} text-white/30`} />
      </div>
      <p className={`font-semibold text-white/40 ${compact ? "text-sm" : "text-lg"}`}>Waiting for others…</p>
      {!compact && <p className="text-sm text-white/25 mt-1">They'll appear here when they join</p>}
    </div>
  ) : (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 rounded-2xl border border-dashed border-white/10">
      <div className={`${compact ? "w-12 h-12" : "w-20 h-20"} rounded-full bg-white/5 flex items-center justify-center mb-3`}>
        <Users className={`${compact ? "w-6 h-6" : "w-10 h-10"} text-white/20`} />
      </div>
      <p className={`font-semibold text-white/30 ${compact ? "text-sm" : "text-lg"}`}>Other participant</p>
    </div>
  );

  // ── Background panel ──────────────────────────────────────────────────────
  const BgPanel = showBgPanel && vbCompatible ? (
    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 rounded-2xl z-50 w-72 p-4 border border-white/10"
      style={{ background: "rgba(18,18,22,0.97)", backdropFilter: "blur(20px)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-white/90 text-sm">Virtual Background</span>
        <button onClick={() => setShowBgPanel(false)} className="text-white/40 hover:text-white/80 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      {bgLoading && <div className="flex items-center gap-2 mb-3 text-purple-400 text-xs"><Loader className="w-3 h-3 animate-spin" /> Applying…</div>}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-white/30 mb-1.5 uppercase tracking-wider">Off</p>
        <button onClick={() => applyBackground("none")}
          className={`w-full py-2 px-3 rounded-xl text-sm font-medium border transition-all ${activeBg === "none" ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"}`}>
          No Background
        </button>
      </div>
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-white/30 mb-1.5 uppercase tracking-wider">Blur</p>
        <div className="grid grid-cols-3 gap-2">
          {BLUR_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => applyBackground(opt.id)}
              className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center ${activeBg === opt.id ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"}`}>
              <div className="text-base mb-0.5">{opt.degree === 1 ? "🌫" : opt.degree === 2 ? "🌁" : "🌫️"}</div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-white/30 mb-1.5 uppercase tracking-wider">Color</p>
        <div className="grid grid-cols-6 gap-1.5">
          {COLOR_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => applyBackground(opt.id)} title={opt.label}
              className={`w-9 h-9 rounded-xl border-2 transition-all active:scale-95 ${activeBg === opt.id ? "border-white ring-2 ring-purple-500 scale-110" : "border-transparent hover:scale-110"}`}
              style={{ backgroundColor: opt.hex }} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-white/30 mb-1.5 uppercase tracking-wider">Custom Image</p>
        <button onClick={() => uploadInputRef.current?.click()}
          className={`w-full py-2 px-3 rounded-xl text-sm font-medium border border-dashed transition-all flex items-center justify-center gap-2 ${activeBg.startsWith("img-") ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-white/15 text-white/50 hover:border-white/30 hover:text-white/70"}`}>
          <Upload className="w-4 h-4" />
          {activeBg.startsWith("img-") ? "Change Image" : "Upload Image"}
        </button>
        <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
      </div>
    </div>
  ) : null;

  // ── Full video mode ───────────────────────────────────────────────────────
  if (mode === "video") {
    return (
      <div className="h-full flex flex-col bg-gray-950 relative overflow-hidden">

        {/* CSS animations */}
        <style>{`
          @keyframes floatUp {
            0%   { transform: translateY(0)      scale(0.6); opacity: 0; }
            12%  { transform: translateY(-30px)  scale(1.3); opacity: 1; }
            80%  { opacity: 1; }
            100% { transform: translateY(-340px) scale(1);   opacity: 0; }
          }
          .emoji-float { animation: floatUp 3.2s cubic-bezier(.25,.46,.45,.94) forwards; }

          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
          .chat-panel { animation: slideInRight 0.25s ease-out; }
        `}</style>

        {/* Floating emojis overlay */}
        {floatingEmojis.map(fe => (
          <div key={fe.id} className="emoji-float pointer-events-none absolute z-50"
            style={{ left: `${fe.x}%`, bottom: "90px", fontSize: "2.8rem", lineHeight: 1 }}>
            {fe.emoji}
          </div>
        ))}

        {/* Video panels area */}
        <div className="flex-1 p-3 flex gap-3 relative min-h-0">
          {LocalPanel}
          {RemotePanel}

          {/* ── Chat panel ────────────────────────────────────────────── */}
          {showChat && (
            <div className="chat-panel absolute inset-y-0 right-4 w-80 bg-white rounded-3xl shadow-2xl border-2 border-purple-200 flex flex-col z-40 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-5 h-5 text-white" />
                  <span className="font-bold text-white text-base">Class Chat</span>
                </div>
                <button onClick={handleToggleChat} className="text-white/70 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-purple-50/40 to-white">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                      <MessageSquare className="w-8 h-8 text-purple-400" />
                    </div>
                    <p className="font-semibold text-gray-500 text-sm">No messages yet</p>
                    <p className="text-gray-400 text-xs mt-1">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.fromSelf ? "items-end" : "items-start"}`}>
                      {!msg.fromSelf && (
                        <span className="text-xs font-semibold text-purple-600 mb-1 px-1">{msg.senderName}</span>
                      )}
                      <div className={`max-w-[88%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        msg.fromSelf
                          ? "bg-gradient-to-br from-purple-500 to-indigo-500 text-white rounded-br-sm"
                          : "bg-white text-gray-800 border border-purple-100 rounded-bl-sm"
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-purple-100 flex-shrink-0 bg-white">
                <form onSubmit={sendMessage} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message…"
                    maxLength={500}
                    className="flex-1 px-4 py-2.5 rounded-full border-2 border-purple-200 focus:border-purple-400 focus:outline-none text-sm bg-purple-50/50 placeholder-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center disabled:opacity-40 hover:scale-105 active:scale-95 transition-all shadow-md"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-3 mb-2 bg-red-950/80 border border-red-800/60 text-red-300 px-4 py-2.5 rounded-xl flex items-center justify-between backdrop-blur-sm">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => { setError(null); if (!joined) joinCall(); }}
              className="text-red-400 hover:text-red-200 font-semibold ml-3 text-sm transition-colors">
              {joined ? "✕" : "Retry"}
            </button>
          </div>
        )}

        {/* Audio autoplay unlock banner */}
        {audioBlocked && (
          <div className="bg-amber-950/80 border-t border-amber-800/50 px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
              <MicOff className="w-3.5 h-3.5 flex-shrink-0" />
              Audio blocked — click to hear the other person
            </div>
            <button
              onClick={() => { setAudioBlocked(false); resumeAudio(remoteUsers); }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0"
            >
              Enable Audio
            </button>
          </div>
        )}

        {/* Controls bar */}
        {joined && (
          <div className="flex-shrink-0 px-4 pb-4 pt-2"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }}>
            <div className="flex items-end justify-center gap-2 relative">

              {/* ── Mic ── */}
              <CtrlBtn
                onClick={toggleMic}
                label={micOn ? "Mute" : "Unmuted"}
                active={micOn}
                danger={!micOn}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </CtrlBtn>

              {/* ── Camera ── */}
              <CtrlBtn
                onClick={toggleCamera}
                label={camOn ? "Camera" : "No Cam"}
                active={camOn}
                danger={!camOn}
              >
                {camOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </CtrlBtn>

              {/* ── Screen share ── */}
              <CtrlBtn
                onClick={toggleScreenShare}
                label={isScreenSharing ? "Stop Share" : "Share"}
                active={!isScreenSharing}
                accent={isScreenSharing ? "blue" : null}
              >
                {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </CtrlBtn>

              {/* ── Virtual background ── */}
              {vbCompatible && vbProcessorRef.current && (
                <div className="relative">
                  {BgPanel}
                  <CtrlBtn
                    onClick={() => { setShowBgPanel(v => !v); setShowEmojiPicker(false); setShowChat(false); }}
                    label="Background"
                    active={!showBgPanel && activeBg === "none"}
                    accent={activeBg !== "none" || showBgPanel ? "purple" : null}
                  >
                    <Layers className="w-5 h-5" />
                  </CtrlBtn>
                </div>
              )}

              {/* ── Chat ── */}
              <div className="relative">
                <CtrlBtn
                  onClick={handleToggleChat}
                  label="Chat"
                  active={!showChat}
                  accent={showChat ? "indigo" : null}
                >
                  <MessageSquare className="w-5 h-5" />
                </CtrlBtn>
                {unreadCount > 0 && !showChat && (
                  <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg pointer-events-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </div>
                )}
              </div>

              {/* ── Emoji reactions ── */}
              <div className="relative">
                {showEmojiPicker && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 rounded-2xl z-50 p-2.5 border border-white/10"
                    style={{ background: "rgba(20,20,24,0.96)", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                    <div className="flex items-center gap-1 overflow-x-auto" style={{ maxWidth: "min(90vw, 480px)" }}>
                      {REACTION_EMOJIS.map(e => (
                        <button key={e} onClick={() => sendEmoji(e)}
                          className="text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-95 transition-all">
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <CtrlBtn
                  onClick={() => { setShowEmojiPicker(v => !v); setShowBgPanel(false); }}
                  label="React"
                  active={!showEmojiPicker}
                  accent={showEmojiPicker ? "yellow" : null}
                >
                  <Smile className="w-5 h-5" />
                </CtrlBtn>
              </div>

              {/* ── Noise cancellation ── */}
              {noiseCancelSupported && (
                <CtrlBtn
                  onClick={toggleNoiseCancel}
                  label={noiseCancel ? "Noise Off" : "Noise On"}
                  active={!noiseCancel}
                  accent={noiseCancel ? "teal" : null}
                  title={noiseCancel ? "Noise cancellation on" : "Noise cancellation off"}
                >
                  <Waves className="w-5 h-5" />
                </CtrlBtn>
              )}

              {/* ── Record (teacher only) ── */}
              {userRole === "teacher" && (
                <div className="relative">
                  {isRecording && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      {formatRecTime(recSeconds)}
                    </div>
                  )}
                  <CtrlBtn
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={uploadingRecording}
                    label={uploadingRecording ? "Saving…" : isRecording ? "Stop Rec" : "Record"}
                    active={!isRecording && !uploadingRecording}
                    accent={isRecording ? "red" : null}
                    pulse={isRecording}
                  >
                    {uploadingRecording
                      ? <Loader className="w-5 h-5 animate-spin" />
                      : isRecording
                      ? <Square className="w-5 h-5 fill-current" />
                      : <Circle className="w-5 h-5" />
                    }
                  </CtrlBtn>
                </div>
              )}

              {/* ── Hang up ── */}
              <CtrlBtn
                onClick={leaveCall}
                label="Leave"
                hangup
              >
                <PhoneOff className="w-5 h-5" />
              </CtrlBtn>

            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Sidebar mode ──────────────────────────────────────────────────────────
  if (mode === "sidebar") {
    return (
      <div className="h-full flex flex-col bg-gray-900 gap-1 p-1.5">
        <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden">{LocalPanel}</div>
        <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden">{RemotePanel}</div>
        {audioBlocked && (
          <button
            onClick={() => { setAudioBlocked(false); resumeAudio(remoteUsers); }}
            className="flex-shrink-0 mx-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-full transition-colors"
          >
            🔊 Enable Audio
          </button>
        )}
        {joined && (
          <div className="flex-shrink-0 flex items-center justify-center gap-2 pb-1">
            <button onClick={toggleMic} title={micOn ? "Mute" : "Unmute"}
              className={`p-2 rounded-full shadow transition-all ${micOn ? "bg-blue-500 text-white" : "bg-red-500 text-white animate-pulse"}`}>
              {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={toggleCamera} title={camOn ? "Camera off" : "Camera on"}
              className={`p-2 rounded-full shadow transition-all ${camOn ? "bg-purple-500 text-white" : "bg-red-500 text-white animate-pulse"}`}>
              {camOn ? <VideoIcon className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Compact mode (whiteboard) ─────────────────────────────────────────────
  return (
    <div className="h-full flex gap-3 p-3 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {LocalPanel}
      {RemotePanel}
    </div>
  );
}
