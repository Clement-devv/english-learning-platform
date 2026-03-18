// src/pages/VideoCall.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import VirtualBackgroundExtension from "agora-extension-virtual-background";
import { io } from "socket.io-client";

AgoraRTC.setParameter("AUDIO_VOLUME_INDICATION_INTERVAL", 200);
import api from "../api";
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

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

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
  const client    = useRef(null);
  const socketRef = useRef(null);

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

  // Emoji reactions
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingEmojis,  setFloatingEmojis]  = useState([]);

  // Live chat
  const [showChat,    setShowChat]    = useState(false);
  const [chatInput,   setChatInput]   = useState("");
  const [messages,    setMessages]    = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const showChatRef    = useRef(false);
  const messagesEndRef = useRef(null);
  useEffect(() => { showChatRef.current = showChat; }, [showChat]);

  // Virtual background
  const vbProcessorRef = useRef(null);
  const [activeBg,    setActiveBg]   = useState("none");
  const [showBgPanel, setShowBgPanel] = useState(false);
  const [bgLoading,   setBgLoading]  = useState(false);

  // Recording
  const [isRecording,       setIsRecording]       = useState(false);
  const [uploadingRecording,setUploadingRecording] = useState(false);
  const [recSeconds,        setRecSeconds]         = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const tabStreamRef     = useRef(null);
  const recTimerRef      = useRef(null);
  const uploadInputRef = useRef(null);
  const customBgUrlRef = useRef(null);

  const localContainer       = useRef(null);
  const remoteContainerRef   = useRef({});
  const isJoiningRef         = useRef(false);
  const hasJoinedRef         = useRef(false);
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

  // ── Auto-scroll chat to latest message ───────────────────────────────────
  useEffect(() => {
    if (showChat) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showChat]);

  // ── Socket: reactions + chat ──────────────────────────────────────────────
  useEffect(() => {
    const sock = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = sock;

    sock.on("connect", () => {
      sock.emit("join-reactions", { channelName });
      sock.emit("join-chat",      { channelName });
    });

    sock.on("emoji-reaction", ({ emoji }) => {
      spawnFloatingEmoji(emoji);
    });

    sock.on("chat-message", ({ id, text, senderName, timestamp }) => {
      setMessages(prev => [...prev, { id, text, senderName, timestamp, fromSelf: false }]);
      if (!showChatRef.current) setUnreadCount(c => c + 1);
    });

    return () => { sock.disconnect(); socketRef.current = null; };
  }, [channelName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Floating emoji ────────────────────────────────────────────────────────
  const spawnFloatingEmoji = useCallback((emoji) => {
    const id   = Date.now() + Math.random();
    const x    = 15 + Math.random() * 70;
    setFloatingEmojis(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 3200);
  }, []);

  const sendEmoji = useCallback((emoji) => {
    spawnFloatingEmoji(emoji);
    setShowEmojiPicker(false);
    socketRef.current?.emit("emoji-reaction", { channelName, emoji });
  }, [channelName, spawnFloatingEmoji]);

  // ── Chat send ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback((e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    const msg = {
      id:         Date.now() + Math.random(),
      text,
      senderName: userName,
      channelName,
      timestamp:  new Date().toISOString(),
    };
    setMessages(prev => [...prev, { ...msg, fromSelf: true }]);
    socketRef.current?.emit("chat-message", msg);
    setChatInput("");
  }, [chatInput, channelName, userName]);

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      // Capture current browser tab — teacher selects "This Tab" in the picker
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: true,
        // Chrome 109+: pre-select current tab to skip the picker prompt
        preferCurrentTab: true,
      });
      tabStreamRef.current = stream;
      chunksRef.current    = [];

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => handleRecordingStop(mimeType);

      // If teacher stops screen share manually, treat as recording stop
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      };

      recorder.start(1000); // collect chunks every 1s
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        console.error("Recording start error:", err);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    tabStreamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(recTimerRef.current);
    setIsRecording(false);
  }, []);

  const handleRecordingStop = useCallback(async (mimeType) => {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (!bookingId || blob.size < 1000) return; // nothing to upload

    try {
      setUploadingRecording(true);
      const ext  = mimeType.includes("mp4") ? ".mp4" : ".webm";
      const form = new FormData();
      form.append("recording", blob, `recording${ext}`);
      form.append("bookingId", bookingId);
      form.append("duration",  String(recSeconds));
      const { default: api } = await import("../api");
      await api.post("/api/recordings/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (err) {
      console.error("Recording upload error:", err);
    } finally {
      setUploadingRecording(false);
    }
  }, [bookingId, recSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      tabStreamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(recTimerRef.current);
    };
  }, []);

  const formatRecTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const toggleChat = useCallback(() => {
    setShowChat(v => {
      if (!v) setUnreadCount(0);
      return !v;
    });
    setShowEmojiPicker(false);
    setShowBgPanel(false);
  }, []);

  // ── Agora event handlers ──────────────────────────────────────────────────
  const handleUserPublished = useCallback(async (user, mediaType) => {
    try {
      await client.current.subscribe(user, mediaType);
      setRemoteUsers(prev => {
        const exists = prev.find(u => u.uid === user.uid);
        if (exists) return prev.map(u => u.uid === user.uid ? user : u);
        onUserJoinedRef.current?.(user.uid);
        return [...prev, user];
      });
      if (mediaType === "audio") { try { user.audioTrack?.play(); } catch (_) {} }
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
    });
  }, [remoteUsers, joined, mode]);

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

      const { data } = await api.get(`/api/agora/token?channel=${channelName}`);
      if (!data.success) throw new Error(data.message || "Token request failed");

      await client.current.join(data.appId, channelName, data.token, null);
      channelJoined = true;
      hasJoinedRef.current = true;
      setJoined(true);

      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks({
        audioConfig: { encoderConfig: "speech_standard" },
        videoConfig: { encoderConfig: "480p_2", optimizationMode: "motion" },
      });

      if (vbCompatible) {
        try {
          const processor = vbExtension.createProcessor();
          await processor.init();
          videoTrack.pipe(processor).pipe(videoTrack.processorDestination);
          vbProcessorRef.current = processor;
          setActiveBg("none");
        } catch (vbErr) { console.warn("⚠️ VB init failed:", vbErr); }
      }

      // Apply browser-native noise suppression (Chrome, Edge, Firefox)
      try {
        const msTrack = audioTrack.getMediaStreamTrack();
        await msTrack.applyConstraints({ noiseSuppression: true, autoGainControl: true, echoCancellation: true });
        setNoiseCancelSupported(true);
      } catch (_) { /* browser doesn't support applyConstraints — button stays hidden */ }

      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      await client.current.publish([audioTrack, videoTrack]);
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
    try {
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
      setFloatingEmojis([]); setShowEmojiPicker(false);
      setMessages([]); setUnreadCount(0); setShowChat(false); setChatInput("");
      onLeave?.();
    } catch (err) { console.error("❌ Leave error:", err); }
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

  // ── Virtual background ────────────────────────────────────────────────────
  const applyBackground = useCallback(async (bgKey) => {
    const processor = vbProcessorRef.current;
    if (!processor) return;
    setBgLoading(true);
    try {
      if (bgKey === "none") {
        await processor.disable();
      } else if (bgKey.startsWith("blur-")) {
        processor.setOptions({ type: "blur", blurDegree: parseInt(bgKey.split("-")[1]) });
        await processor.enable();
      } else if (bgKey.startsWith("color-")) {
        processor.setOptions({ type: "color", color: bgKey.slice(6) });
        await processor.enable();
      } else if (bgKey.startsWith("img-")) {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = bgKey.slice(4); });
        processor.setOptions({ type: "img", source: img, fit: "cover" });
        await processor.enable();
      }
      setActiveBg(bgKey);
    } catch (e) { console.error("❌ VB error:", e); }
    finally     { setBgLoading(false); }
  }, []);

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
    <div className={`flex-1 relative bg-gradient-to-br from-purple-100 to-blue-100 rounded-3xl overflow-hidden shadow-2xl border-4 border-white ${compact ? "min-h-0" : ""}`}>
      {joined ? (
        <>
          <div ref={localContainer} className="w-full h-full" />
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
            <span className={`font-bold text-purple-700 ${compact ? "text-xs" : "text-sm"}`}>{userName} (You)</span>
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
    <div className="flex-1 relative bg-gradient-to-br from-pink-100 to-purple-100 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
      {remoteUsers.map(user => (
        <div key={user.uid} className="w-full h-full relative">
          <div ref={el => { remoteContainerRef.current[user.uid] = el; }} className="w-full h-full" />
          {!user.videoTrack && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100">
              <div className={`${compact ? "w-14 h-14" : "w-24 h-24"} rounded-full bg-purple-200 flex items-center justify-center mb-3`}>
                <Users className={`${compact ? "w-7 h-7" : "w-12 h-12"} text-purple-500`} />
              </div>
              <p className={`text-purple-600 font-semibold ${compact ? "text-xs" : "text-sm"}`}>Camera off</p>
            </div>
          )}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
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

  // ── Background panel ──────────────────────────────────────────────────────
  const BgPanel = showBgPanel && vbCompatible ? (
    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border-2 border-purple-200 p-4 z-50 w-72">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-gray-700 text-sm">Virtual Background</span>
        <button onClick={() => setShowBgPanel(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      {bgLoading && <div className="flex items-center gap-2 mb-3 text-purple-600 text-xs"><Loader className="w-3 h-3 animate-spin" /> Applying…</div>}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Off</p>
        <button onClick={() => applyBackground("none")}
          className={`w-full py-2 px-3 rounded-xl text-sm font-medium border-2 transition-all ${activeBg === "none" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-purple-300"}`}>
          No Background
        </button>
      </div>
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Blur</p>
        <div className="grid grid-cols-3 gap-2">
          {BLUR_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => applyBackground(opt.id)}
              className={`py-2 px-2 rounded-xl text-xs font-medium border-2 transition-all text-center ${activeBg === opt.id ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-purple-300"}`}>
              <div className="text-lg mb-0.5">{opt.degree === 1 ? "🌫" : opt.degree === 2 ? "🌁" : "🌫️"}</div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Color</p>
        <div className="grid grid-cols-6 gap-1.5">
          {COLOR_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => applyBackground(opt.id)} title={opt.label}
              className={`w-9 h-9 rounded-xl border-2 transition-all ${activeBg === opt.id ? "border-white ring-2 ring-purple-500 scale-110" : "border-white hover:scale-110"}`}
              style={{ backgroundColor: opt.hex }} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Custom Image</p>
        <button onClick={() => uploadInputRef.current?.click()}
          className={`w-full py-2 px-3 rounded-xl text-sm font-medium border-2 border-dashed transition-all flex items-center justify-center gap-2 ${activeBg.startsWith("img-") ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-300 text-gray-600 hover:border-purple-400"}`}>
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
      <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 relative overflow-hidden">

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
        <div className="flex-1 p-4 flex gap-4 relative min-h-0">
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
                <button onClick={toggleChat} className="text-white/70 hover:text-white transition-colors">
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
          <div className="mx-4 mb-2 bg-red-100 border-2 border-red-300 text-red-700 px-4 py-3 rounded-2xl flex items-center justify-between">
            <span className="font-medium">{error}</span>
            <button onClick={() => { setError(null); if (!joined) joinCall(); }} className="text-red-500 hover:text-red-700 font-bold ml-3">
              {joined ? "✕" : "Retry"}
            </button>
          </div>
        )}

        {/* Controls bar */}
        <div className="bg-white border-t-2 border-purple-200 p-4 shadow-lg flex-shrink-0">
          {joined && (
            <div className="flex items-center justify-center gap-3 relative">

              {/* Mic */}
              <button onClick={toggleMic}
                className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${micOn ? "bg-gradient-to-br from-blue-400 to-blue-500 text-white" : "bg-gradient-to-br from-red-400 to-red-500 text-white animate-pulse"}`}>
                {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>

              {/* Camera */}
              <button onClick={toggleCamera}
                className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${camOn ? "bg-gradient-to-br from-purple-400 to-purple-500 text-white" : "bg-gradient-to-br from-red-400 to-red-500 text-white animate-pulse"}`}>
                {camOn ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>

              {/* Screen share */}
              <button onClick={toggleScreenShare}
                className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${isScreenSharing ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white" : "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700"}`}>
                {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
              </button>

              {/* Virtual background */}
              {vbCompatible && vbProcessorRef.current && (
                <div className="relative">
                  {BgPanel}
                  <button
                    onClick={() => { setShowBgPanel(v => !v); setShowEmojiPicker(false); setShowChat(false); }}
                    title="Virtual Background"
                    className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${activeBg !== "none" ? "bg-gradient-to-br from-purple-500 to-indigo-500 text-white" : showBgPanel ? "bg-gradient-to-br from-purple-300 to-indigo-300 text-white" : "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700"}`}>
                    <Layers className="w-6 h-6" />
                  </button>
                </div>
              )}

              {/* Chat */}
              <div className="relative">
                <button
                  onClick={toggleChat}
                  title="Chat"
                  className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${showChat ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white" : "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700"}`}>
                  <MessageSquare className="w-6 h-6" />
                </button>
                {unreadCount > 0 && !showChat && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </div>
                )}
              </div>

              {/* Emoji reactions */}
              <div className="relative">
                {showEmojiPicker && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border-2 border-yellow-300 z-50 p-3">
                    <div className="flex items-center gap-1.5 overflow-x-auto" style={{ maxWidth: "min(90vw, 520px)" }}>
                      {REACTION_EMOJIS.map(e => (
                        <button key={e} onClick={() => sendEmoji(e)}
                          className="text-3xl flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl hover:bg-yellow-50 hover:scale-125 transition-all">
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => { setShowEmojiPicker(v => !v); setShowBgPanel(false); }}
                  className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${showEmojiPicker ? "bg-gradient-to-br from-yellow-400 to-yellow-500 text-white" : "bg-gradient-to-br from-yellow-300 to-yellow-400 text-gray-700"}`}>
                  <Smile className="w-6 h-6" />
                </button>
              </div>

              {/* Noise cancellation */}
              {noiseCancelSupported && (
                <button onClick={toggleNoiseCancel}
                  title={noiseCancel ? "Noise cancellation on" : "Noise cancellation off"}
                  className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${noiseCancel ? "bg-gradient-to-br from-teal-400 to-teal-500 text-white" : "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700"}`}>
                  <Waves className="w-6 h-6" />
                </button>
              )}

              {/* Record — teacher only */}
              {userRole === "teacher" && (
                <div className="relative">
                  {isRecording && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                      {formatRecTime(recSeconds)}
                    </div>
                  )}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={uploadingRecording}
                    title={isRecording ? "Stop recording" : "Record class"}
                    className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${
                      isRecording
                        ? "bg-gradient-to-br from-red-500 to-red-600 text-white animate-pulse"
                        : uploadingRecording
                        ? "bg-gray-400 text-white cursor-wait"
                        : "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700"
                    }`}>
                    {uploadingRecording
                      ? <Loader className="w-6 h-6 animate-spin" />
                      : isRecording
                      ? <Square className="w-6 h-6" />
                      : <Circle className="w-6 h-6" />
                    }
                  </button>
                </div>
              )}

              {/* Hang up */}
              <button onClick={leaveCall}
                className="p-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg transform hover:scale-110 transition-all">
                <PhoneOff className="w-6 h-6" />
              </button>

            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Sidebar mode ──────────────────────────────────────────────────────────
  if (mode === "sidebar") {
    return (
      <div className="h-full flex flex-col bg-gray-900 gap-1 p-1.5">
        <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden">{LocalPanel}</div>
        <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden">{RemotePanel}</div>
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
