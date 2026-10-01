// src/components/AudioRecorder.jsx
// Reusable mic recorder — gives parent a Blob via onRecorded(blob, durationSeconds).
// Every button is type="button": this component is used inside <form>s, where a
// plain <button> would submit the form.
import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Play, Pause } from "lucide-react";

export default function AudioRecorder({
  onRecorded,
  isDarkMode,
  label = "Voice Feedback (optional)",
  recordLabel = "Record Voice Note",
  maxSeconds = 0, // 0 = no limit; otherwise auto-stops
}) {
  const [state,    setState]    = useState("idle");   // idle | recording | preview
  const [seconds,  setSeconds]  = useState(0);
  const [blobUrl,  setBlobUrl]  = useState(null);
  const [playing,  setPlaying]  = useState(false);

  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);
  const timerRef     = useRef(null);
  const audioRef     = useRef(null);
  const secondsRef   = useRef(0);   // live count — the onstop closure can't read state
  const blobUrlRef   = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    mediaRecRef.current?.stream?.getTracks().forEach(t => t.stop());
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  // Center brand colour (set by utils/branding.js), with a neutral fallback
  const brand = "var(--brand-primary, #2563eb)";
  const brandTint = (a) => `rgba(var(--brand-primary-rgb, 37, 99, 235), ${a})`;
  const col = {
    bg:     isDarkMode ? "#1e2235" : brandTint(0.06),
    border: isDarkMode ? "#2a2d40" : brandTint(0.3),
    text:   isDarkMode ? "#e8eaf6" : "#1e293b",
  };
  const btn = (bg, color = "#fff") => ({
    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none",
    background: bg, color, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
  });

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (mediaRecRef.current?.state === "recording") mediaRecRef.current.stop();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
        MediaRecorder.isTypeSupported("audio/webm")             ? "audio/webm"             :
        MediaRecorder.isTypeSupported("audio/mp4")              ? "audio/mp4"              :
        "";

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecRef.current = rec;
      chunksRef.current   = [];

      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = (rec.mimeType || mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type });
        const url  = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        onRecorded(blob, secondsRef.current);
        setState("preview");
        stream.getTracks().forEach(t => t.stop());
      };

      rec.start(200);
      setState("recording");
      secondsRef.current = 0;
      setSeconds(0);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (maxSeconds && secondsRef.current >= maxSeconds) stopRecording();
      }, 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
      alert("Please allow microphone access to record.");
    }
  };

  const discard = () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
    setBlobUrl(null);
    secondsRef.current = 0;
    setSeconds(0);
    setPlaying(false);
    setState("idle");
    onRecorded(null, 0);
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (err) {
        console.error("Audio playback failed:", err);
      }
    }
  };

  return (
    <div style={{ background: col.bg, border: `1.5px solid ${col.border}`, borderRadius: 12, padding: "12px 14px" }}>

      {/* Hidden audio element for playback */}
      {blobUrl && (
        <audio ref={audioRef} src={blobUrl} onEnded={() => setPlaying(false)} style={{ display: "none" }} />
      )}

      {label && (
        <div style={{ fontSize: 11, fontWeight: 800, color: col.text, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          🎤 {label}
        </div>
      )}

      {state === "idle" && (
        <button type="button" onClick={startRecording} style={btn(brand)}>
          <Mic size={15} /> {recordLabel}
        </button>
      )}

      {state === "recording" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#ef4444" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite", display: "inline-block" }} />
            Recording {formatTime(seconds)}{maxSeconds ? ` / ${formatTime(maxSeconds)}` : ""}
          </span>
          <button type="button" onClick={stopRecording} style={btn("#ef4444")}>
            <Square size={13} fill="white" /> Stop
          </button>
        </div>
      )}

      {state === "preview" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={togglePlay} style={btn(brand)}>
            {playing ? <Pause size={13} /> : <Play size={13} fill="white" />}
            {playing ? "Pause" : "Listen"}
          </button>
          <span style={{ fontSize: 12, color: col.text, fontWeight: 700 }}>
            {formatTime(secondsRef.current)}
          </span>
          <button type="button" onClick={discard} style={btn("rgba(239,68,68,0.12)", "#ef4444")}>
            <Trash2 size={13} /> Re-record
          </button>
          <span style={{ fontSize: 11, color: brand, fontWeight: 700 }}>✓ Ready</span>
        </div>
      )}
    </div>
  );
}
