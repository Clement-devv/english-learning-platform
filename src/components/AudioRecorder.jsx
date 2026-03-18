// src/components/AudioRecorder.jsx
// Reusable mic recorder — gives parent a Blob via onRecorded(blob, durationSeconds)
import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Play, Pause } from "lucide-react";

export default function AudioRecorder({ onRecorded, isDarkMode }) {
  const [state,    setState]    = useState("idle");   // idle | recording | preview
  const [seconds,  setSeconds]  = useState(0);
  const [blobUrl,  setBlobUrl]  = useState(null);
  const [playing,  setPlaying]  = useState(false);

  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);
  const timerRef     = useRef(null);
  const audioRef     = useRef(null);
  const durationRef  = useRef(0);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    mediaRecRef.current?.stream?.getTracks().forEach(t => t.stop());
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const col = {
    bg:     isDarkMode ? "#1e2235" : "#f0fdf4",
    border: isDarkMode ? "#2a2d40" : "#86efac",
    text:   isDarkMode ? "#e8eaf6" : "#065f46",
    muted:  isDarkMode ? "#8b91b8" : "#4ade80",
  };

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";

      const rec = new MediaRecorder(stream, { mimeType });
      mediaRecRef.current = rec;
      chunksRef.current   = [];

      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url  = URL.createObjectURL(blob);
        setBlobUrl(url);
        durationRef.current = seconds;
        onRecorded(blob, seconds);
        setState("preview");
        stream.getTracks().forEach(t => t.stop());
      };

      rec.start(200);
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
      alert("Microphone access is required to record feedback.");
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    mediaRecRef.current?.stop();
  };

  const discard = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setSeconds(0);
    setPlaying(false);
    setState("idle");
    onRecorded(null, 0);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else         { audioRef.current.play();  setPlaying(true);  }
  };

  return (
    <div style={{ background: col.bg, border: `1.5px solid ${col.border}`, borderRadius: 12, padding: "12px 14px" }}>

      {/* Hidden audio element for playback */}
      {blobUrl && (
        <audio ref={audioRef} src={blobUrl} onEnded={() => setPlaying(false)} style={{ display: "none" }} />
      )}

      <div style={{ fontSize: 11, fontWeight: 800, color: col.text, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        🎤 Voice Feedback (optional)
      </div>

      {state === "idle" && (
        <button onClick={startRecording}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
          <Mic size={15} /> Record Voice Note
        </button>
      )}

      {state === "recording" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#ef4444" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite", display: "inline-block" }} />
            Recording {formatTime(seconds)}
          </span>
          <button onClick={stopRecording}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            <Square size={13} fill="white" /> Stop
          </button>
        </div>
      )}

      {state === "preview" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={togglePlay}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            {playing ? <Pause size={13} /> : <Play size={13} fill="white" />}
            {playing ? "Pause" : "Preview"}
          </button>
          <span style={{ fontSize: 12, color: col.text, fontWeight: 700 }}>
            {formatTime(durationRef.current)}
          </span>
          <button onClick={discard}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.12)", color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            <Trash2 size={13} /> Re-record
          </button>
          <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>✓ Ready to submit</span>
        </div>
      )}
    </div>
  );
}
