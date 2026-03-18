/**
 * ListenButton.jsx
 * Uses the browser's built-in SpeechSynthesis API — 100% free, no API calls.
 * Shows 🔊 Listen when idle, ⏹ Stop while speaking.
 */

import { useState, useEffect, useRef } from "react";

export default function ListenButton({ text, style = {} }) {
  const [speaking, setSpeaking] = useState(false);
  const uttRef = useRef(null);

  // Stop speech if component unmounts or text changes
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!("speechSynthesis" in window) || !text?.trim()) return null;

  const handleClick = (e) => {
    e.stopPropagation(); // don't trigger parent expand/collapse

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel(); // stop anything currently playing

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang  = "en-US";
    utt.rate  = 0.9;   // slightly slower — good for learners
    utt.pitch = 1;

    utt.onstart = () => setSpeaking(true);
    utt.onend   = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);

    uttRef.current = utt;
    window.speechSynthesis.speak(utt);
  };

  return (
    <button
      onClick={handleClick}
      title={speaking ? "Stop" : "Listen to this text"}
      style={{
        display:     "inline-flex",
        alignItems:  "center",
        gap:         5,
        padding:     "4px 12px",
        borderRadius: 20,
        border:      `1.5px solid ${speaking ? "#ef4444" : "#7c3aed"}`,
        background:  speaking ? "#fee2e2" : "#f5f3ff",
        color:       speaking ? "#dc2626" : "#7c3aed",
        fontSize:    12,
        fontWeight:  700,
        cursor:      "pointer",
        flexShrink:  0,
        fontFamily:  "'Nunito', sans-serif",
        ...style,
      }}
    >
      {speaking ? "⏹ Stop" : "🔊 Listen"}
    </button>
  );
}
