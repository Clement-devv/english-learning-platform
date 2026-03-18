import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import api from "../../../api";
import { Send, Trash2, RefreshCw, Zap, Mic, MicOff, Volume2, VolumeX, Box, Circle } from "lucide-react";

// Lazy-load the heavy Three.js bundle — only downloaded when student switches to 3D
const AvatarHead3D = lazy(() => import("../../../components/AvatarHead3D"));

const LEVELS = [
  { value: "beginner",     label: "🌱 Beginner"     },
  { value: "intermediate", label: "🌿 Intermediate"  },
  { value: "advanced",     label: "🌳 Advanced"      },
];

const HAS_SPEECH_INPUT  = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const HAS_SPEECH_OUTPUT = !!window.speechSynthesis;

function CreditBadge({ credits }) {
  const color = credits === 0 ? "#dc2626" : credits <= 10 ? "#d97706" : "#059669";
  const bg    = credits === 0 ? "#fee2e2" : credits <= 10 ? "#fef3c7" : "#dcfce7";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 800, color, background: bg }}>
      <Zap size={13} fill={color} />
      {credits} credit{credits !== 1 ? "s" : ""} left
    </span>
  );
}

function Message({ msg, isDarkMode, onSpeak, isSpeaking }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      {!isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: isSpeaking ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, marginRight: 10, alignSelf: "flex-end",
          transition: "background 0.3s",
          boxShadow: isSpeaking ? "0 0 12px #10b98160" : "none",
        }}>
          {isSpeaking ? "🔊" : "🤖"}
        </div>
      )}
      <div style={{ maxWidth: "75%", position: "relative" }}>
        <div style={{
          padding: "12px 16px",
          borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
          background: isUser
            ? "linear-gradient(135deg,#7c3aed,#a855f7)"
            : isDarkMode ? "#1f2235" : "#f3f0ff",
          color: isUser ? "#fff" : isDarkMode ? "#e2e8f0" : "#2d1f6e",
          fontSize: 14, lineHeight: 1.6, fontWeight: 500,
          boxShadow: isUser ? "0 2px 12px #7c3aed30" : "none",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {msg.content}
        </div>
        {/* Speak button on AI messages */}
        {!isUser && HAS_SPEECH_OUTPUT && (
          <button
            onClick={() => onSpeak(msg.content)}
            title={isSpeaking ? "Stop" : "Read aloud"}
            style={{
              position: "absolute", bottom: -8, right: 8,
              width: 26, height: 26, borderRadius: "50%", border: "none",
              background: isSpeaking ? "#10b981" : "#7c3aed20",
              color: isSpeaking ? "#fff" : "#7c3aed",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, transition: "all 0.15s",
            }}>
            {isSpeaking ? "⏹" : "🔊"}
          </button>
        )}
      </div>
      {isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg,#f97316,#ec4899)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, marginLeft: 10, alignSelf: "flex-end",
        }}>🧑‍🎓</div>
      )}
    </div>
  );
}

function TypingIndicator({ isDarkMode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
      <div style={{ padding: "12px 18px", borderRadius: "20px 20px 20px 4px", background: isDarkMode ? "#1f2235" : "#f3f0ff", display: "flex", gap: 6, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", animation: "bounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

export default function ConversationTab({ studentInfo, isDarkMode }) {
  const col = isDarkMode
    ? { bg: "#0f1117", card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#6b7090", input: "#0f1117" }
    : { bg: "#fff8f0", card: "#ffffff", border: "#ffe8cc", heading: "#2d1f6e", body: "#4a4060", muted: "#9b8ab0", input: "#fff" };

  const [messages,   setMessages]   = useState([]);
  const [credits,    setCredits]    = useState(null);
  const [text,       setText]       = useState("");
  const [sending,    setSending]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [level,      setLevel]      = useState("beginner");
  const [toast,      setToast]      = useState(null);

  // Voice input state
  const [listening,  setListening]  = useState(false);
  const [liveText,   setLiveText]   = useState(""); // interim transcript while recording

  // Voice output state
  const [autoSpeak,  setAutoSpeak]  = useState(true);  // auto-read AI replies
  const [speakingId, setSpeakingId] = useState(null);  // message _id being spoken

  // Avatar mode — persisted in localStorage
  const [avatarMode, setAvatarMode] = useState(
    () => localStorage.getItem("chatAvatarMode") || "classic"
  );

  const toggleAvatarMode = () => {
    setAvatarMode(prev => {
      const next = prev === "classic" ? "3d" : "classic";
      localStorage.setItem("chatAvatarMode", next);
      return next;
    });
  };

  const bottomRef       = useRef(null);
  const inputRef        = useRef(null);
  const recognitionRef  = useRef(null);
  const finalTextRef    = useRef("");
  const mountedRef      = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [histRes, credRes] = await Promise.all([
          api.get("/api/chat/history"),
          api.get("/api/chat/credits"),
        ]);
        if (!mountedRef.current) return;
        setMessages(histRes.data.messages || []);
        setCredits(credRes.data.credits ?? 0);
      } catch {
        if (mountedRef.current) showToast("Failed to load chat", "error");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── Text-to-speech ──────────────────────────────────────────────────────────
  const speakText = useCallback((content, msgId) => {
    if (!HAS_SPEECH_OUTPUT) return;
    window.speechSynthesis.cancel();

    if (speakingId === msgId) {
      setSpeakingId(null);
      return;
    }

    const utt   = new SpeechSynthesisUtterance(content);
    utt.lang    = "en-US";
    utt.rate    = 0.9;
    utt.pitch   = 1;
    utt.onstart = () => { if (mountedRef.current) setSpeakingId(msgId); };
    utt.onend   = () => { if (mountedRef.current) setSpeakingId(null); };
    utt.onerror = () => { if (mountedRef.current) setSpeakingId(null); };
    window.speechSynthesis.speak(utt);
  }, [speakingId]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (overrideText) => {
    const trimmed = (overrideText ?? text).trim();
    if (!trimmed || sending) return;
    if (credits <= 0) { showToast("No credits left! Ask your teacher to top up.", "error"); return; }

    setText("");
    setLiveText("");
    setSending(true);

    const optimistic = { _id: Date.now(), role: "user", content: trimmed };
    setMessages(prev => [...prev, optimistic]);

    try {
      const { data } = await api.post("/api/chat/message", { text: trimmed, level });
      if (!mountedRef.current) return;

      const aiMsg = { _id: Date.now() + 2, role: "assistant", content: data.reply };
      setMessages(prev => [
        ...prev.filter(m => m._id !== optimistic._id),
        { _id: Date.now() + 1, role: "user", content: trimmed },
        aiMsg,
      ]);
      setCredits(data.creditsRemaining);

      // Auto-speak AI reply if enabled
      if (autoSpeak && HAS_SPEECH_OUTPUT) {
        speakText(data.reply, aiMsg._id);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setMessages(prev => prev.filter(m => m._id !== optimistic._id));
      const msg = err?.response?.data?.message || "Failed to send message";
      if (err?.response?.status === 402) setCredits(0);
      showToast(msg, "error");
    } finally {
      if (mountedRef.current) {
        setSending(false);
        inputRef.current?.focus();
      }
    }
  }, [text, sending, credits, level, autoSpeak, speakText]);

  // ── Voice input ─────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    window.speechSynthesis?.cancel(); // stop any playing TTS before recording
    setSpeakingId(null);

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = "en-US";
    finalTextRef.current = "";

    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += " " + e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (final) finalTextRef.current += final;
      setLiveText((finalTextRef.current + " " + interim).trim());
    };

    rec.onend = () => {
      if (!mountedRef.current) return;
      setListening(false);
      const spoken = finalTextRef.current.trim();
      if (spoken) {
        setText(spoken);
        setLiveText("");
        // Auto-send after voice input
        setTimeout(() => sendMessage(spoken), 100);
      } else {
        setLiveText("");
      }
    };

    rec.onerror = (e) => {
      console.error("Speech error:", e.error);
      if (mountedRef.current) { setListening(false); setLiveText(""); }
    };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggleMic = () => {
    if (listening) stopListening();
    else startListening();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear your entire conversation history?")) return;
    try {
      await api.delete("/api/chat/history");
      setMessages([]);
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
      showToast("Conversation cleared!");
    } catch {
      showToast("Failed to clear history", "error");
    }
  };

  // ── No credits screen ───────────────────────────────────────────────────────
  if (!loading && credits === 0) {
    return (
      <div style={{ fontFamily: "'Nunito', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "60px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 64 }}>💬</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: col.heading }}>Chat Credits Needed</h2>
        <p style={{ margin: 0, fontSize: 14, color: col.muted, maxWidth: 360, lineHeight: 1.7 }}>
          You've used all your conversation credits. Ask your teacher to top up your credits so you can keep practising!
        </p>
        <div style={{ background: isDarkMode ? "#1f2235" : "#f5f3ff", border: `2px solid #7c3aed40`, borderRadius: 16, padding: "16px 24px", fontSize: 13, color: col.body, lineHeight: 1.8, maxWidth: 340 }}>
          <strong style={{ color: "#7c3aed" }}>💡 How credits work:</strong><br />
          Each message = 1 credit<br />
          Your teacher grants credits when you pay for a top-up<br />
          Credits never expire
        </div>
      </div>
    );
  }

  const inputDisabled = sending || credits === 0 || listening;

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", display: "flex", flexDirection: "column", height: "70vh", minHeight: 500 }}>

      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, padding: "12px 22px", borderRadius: 14, fontWeight: 700, fontSize: 14, background: toast.type === "error" ? "#fee2e2" : "#dcfce7", color: toast.type === "error" ? "#dc2626" : "#16a34a", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 16px", borderBottom: `2px solid ${col.border}`, flexShrink: 0, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: speakingId ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            boxShadow: speakingId ? "0 0 16px #10b98150" : "none",
            transition: "all 0.3s",
          }}>
            {speakingId ? "🔊" : "🤖"}
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: col.heading }}>AI Conversation Coach</div>
            <div style={{ fontSize: 12, color: col.muted }}>
              {listening ? "🎤 Listening…" : speakingId ? "🔊 Speaking…" : "Practise English 24/7 · Corrections included"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {credits !== null && <CreditBadge credits={credits} />}

          {/* Avatar mode toggle */}
          <button
            onClick={toggleAvatarMode}
            title={avatarMode === "3d" ? "Switch to classic view" : "Switch to 3D avatar"}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
              borderRadius: 10, border: `2px solid ${avatarMode === "3d" ? "#7c3aed" : col.border}`,
              background: avatarMode === "3d" ? "#f5f3ff" : col.card,
              color: avatarMode === "3d" ? "#7c3aed" : col.muted,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
            {avatarMode === "3d" ? <Box size={13} /> : <Circle size={13} />}
            {avatarMode === "3d" ? "3D On" : "3D Off"}
          </button>

          {/* Auto-speak toggle */}
          {HAS_SPEECH_OUTPUT && (
            <button onClick={() => { setAutoSpeak(v => !v); window.speechSynthesis?.cancel(); setSpeakingId(null); }}
              title={autoSpeak ? "Auto-read ON — click to turn off" : "Auto-read OFF — click to turn on"}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                borderRadius: 10, border: `2px solid ${autoSpeak ? "#7c3aed" : col.border}`,
                background: autoSpeak ? "#f5f3ff" : col.card,
                color: autoSpeak ? "#7c3aed" : col.muted,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
              {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {autoSpeak ? "Auto-read ON" : "Auto-read OFF"}
            </button>
          )}

          <select value={level} onChange={e => setLevel(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 10, border: `2px solid ${col.border}`, background: col.card, color: col.body, fontSize: 13, fontWeight: 700, fontFamily: "'Nunito', sans-serif", cursor: "pointer" }}>
            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <button onClick={clearHistory} title="Clear conversation"
            style={{ padding: "6px 10px", borderRadius: 10, border: `2px solid ${col.border}`, background: col.card, color: col.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700 }}>
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      {/* 3D Avatar Panel — only rendered when student picks 3D mode */}
      {avatarMode === "3d" && (
        <div style={{
          height: 240, flexShrink: 0, borderRadius: 16, overflow: "hidden",
          margin: "12px 0 0",
          background: isDarkMode
            ? "linear-gradient(180deg,#1a1d2e 0%,#0f1117 100%)"
            : "linear-gradient(180deg,#f0ecff 0%,#e9d5ff 100%)",
          border: `2px solid ${isDarkMode ? "#2a2d40" : "#ddd6fe"}`,
          position: "relative",
        }}>
          {/* Speaking glow ring */}
          {speakingId && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 16, pointerEvents: "none",
              boxShadow: "inset 0 0 30px #10b98140",
              border: "2px solid #10b98160",
              zIndex: 2, transition: "opacity 0.3s",
            }} />
          )}
          <Suspense fallback={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#7c3aed", fontWeight: 700, fontSize: 13 }}>
              Loading 3D avatar…
            </div>
          }>
            <AvatarHead3D isSpeaking={!!speakingId} isDarkMode={isDarkMode} />
          </Suspense>
          {/* Status label */}
          <div style={{
            position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
            background: isDarkMode ? "#0f111799" : "#ffffff99",
            backdropFilter: "blur(8px)",
            padding: "4px 14px", borderRadius: 20,
            fontSize: 11, fontWeight: 700,
            color: speakingId ? "#059669" : isDarkMode ? "#a78bfa" : "#7c3aed",
            zIndex: 3,
          }}>
            {listening ? "🎤 Listening…" : speakingId ? "🔊 Speaking…" : "AI Coach · Ready"}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 4px", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: col.muted }}>
            <RefreshCw size={28} style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: 12, fontWeight: 700 }}>Loading conversation…</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: col.muted }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>💬</div>
            <p style={{ fontWeight: 800, fontSize: 16, color: col.heading, margin: "0 0 8px" }}>Start a conversation!</p>
            <p style={{ fontSize: 13, maxWidth: 340, margin: "0 auto", lineHeight: 1.7 }}>
              {HAS_SPEECH_INPUT ? "Type or tap 🎤 to speak. The AI replies and reads its answer aloud." : "Type a message below. The AI will chat and gently correct your English."}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
              {["👋 Hello! How are you?", "Tell me about yourself", "What should I talk about?", "Let's practise past tense"].map(s => (
                <button key={s} onClick={() => { setText(s); inputRef.current?.focus(); }}
                  style={{ padding: "8px 14px", borderRadius: 20, border: `2px solid #7c3aed40`, background: isDarkMode ? "#1f2235" : "#f5f3ff", color: "#7c3aed", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <Message
              key={msg._id ?? i}
              msg={msg}
              isDarkMode={isDarkMode}
              onSpeak={(content) => speakText(content, msg._id ?? i)}
              isSpeaking={speakingId === (msg._id ?? i)}
            />
          ))
        )}
        {sending && <TypingIndicator isDarkMode={isDarkMode} />}
        <div ref={bottomRef} />
      </div>

      {/* Live transcript while recording */}
      {listening && (
        <div style={{
          padding: "10px 16px", borderRadius: 12, margin: "0 0 8px",
          background: "#fef3c7", border: "1.5px solid #fde68a",
          fontSize: 13, fontWeight: 600, color: "#92400e",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s ease-in-out infinite", flexShrink: 0 }} />
          {liveText || "Listening… speak now"}
        </div>
      )}

      {/* Input bar */}
      <div style={{ borderTop: `2px solid ${col.border}`, paddingTop: 14, flexShrink: 0, display: "flex", gap: 8, alignItems: "flex-end" }}>

        {/* Mic button */}
        {HAS_SPEECH_INPUT && (
          <button onClick={toggleMic} disabled={sending || credits === 0}
            title={listening ? "Stop recording" : "Speak your message"}
            style={{
              width: 48, height: 48, borderRadius: 14, border: "none", flexShrink: 0,
              background: listening
                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : (isDarkMode ? "#2a2d40" : "#f5f3ff"),
              color: listening ? "#fff" : "#7c3aed",
              cursor: sending || credits === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: listening ? "0 0 16px #ef444460" : "none",
              animation: listening ? "pulse-btn 1s ease-in-out infinite" : "none",
              transition: "all 0.2s",
              opacity: credits === 0 ? 0.4 : 1,
            }}>
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}

        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            credits === 0 ? "No credits left…"
            : listening ? "Speaking… (will send automatically)"
            : HAS_SPEECH_INPUT ? "Type or tap 🎤 to speak…"
            : "Type your message… (Enter to send)"
          }
          disabled={inputDisabled}
          maxLength={1000}
          rows={1}
          style={{
            flex: 1, padding: "12px 16px", borderRadius: 16,
            border: `2px solid ${listening ? "#ef4444" : isDarkMode ? "#2a2d40" : "#ddd6fe"}`,
            background: col.input, color: col.heading, fontSize: 14,
            fontFamily: "'Nunito', sans-serif", lineHeight: 1.5,
            resize: "none", boxSizing: "border-box",
            opacity: inputDisabled ? 0.6 : 1,
            maxHeight: 120, overflowY: "auto",
            transition: "border-color 0.2s",
          }}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
        />

        {/* Send button */}
        <button onClick={() => sendMessage()}
          disabled={sending || !text.trim() || credits === 0 || listening}
          style={{
            width: 48, height: 48, borderRadius: 14, border: "none", flexShrink: 0,
            background: sending || !text.trim() || credits === 0 || listening
              ? (isDarkMode ? "#2a2d40" : "#e9d5ff")
              : "linear-gradient(135deg,#7c3aed,#a855f7)",
            color: sending || !text.trim() || credits === 0 || listening ? col.muted : "#fff",
            cursor: sending || !text.trim() || credits === 0 || listening ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: !sending && text.trim() ? "0 4px 14px #7c3aed40" : "none",
            transition: "all 0.15s",
          }}>
          <Send size={18} />
        </button>
      </div>

      {/* Low credits warning */}
      {credits !== null && credits > 0 && credits <= 10 && (
        <div style={{ marginTop: 10, padding: "8px 14px", borderRadius: 10, background: "#fef3c7", border: "1.5px solid #fde68a", fontSize: 12, fontWeight: 700, color: "#92400e", textAlign: "center" }}>
          ⚠️ Only {credits} credit{credits !== 1 ? "s" : ""} left — ask your teacher to top up soon
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes pulse-btn { 0%,100%{box-shadow:0 0 16px #ef444460} 50%{box-shadow:0 0 28px #ef4444a0} }
      `}</style>
    </div>
  );
}
