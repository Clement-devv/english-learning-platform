import { useState, useRef, useCallback, useEffect } from "react";
import api from "../../../api";

// ── Local sentence bank ───────────────────────────────────────────────────────
const LOCAL_SENTENCES = {
  beginner: [
    { text: "The cat sat on the mat.", focus: "Short vowels" },
    { text: "I like to eat apples every day.", focus: "Basic vowels" },
    { text: "She has a big red bag.", focus: "Short vowels" },
    { text: "Can you help me find my book?", focus: "Question intonation" },
    { text: "The dog runs fast in the park.", focus: "Basic fluency" },
    { text: "I am happy to see you today.", focus: "Natural rhythm" },
    { text: "He drinks a cup of tea in the morning.", focus: "Connected speech" },
    { text: "We play games after school every day.", focus: "Basic fluency" },
    { text: "My name is easy to remember.", focus: "Basic vowels" },
    { text: "She went to the shop to buy some bread.", focus: "Past tense sounds" },
    { text: "The sun is hot and the sky is blue.", focus: "Short vowels" },
    { text: "I want a glass of cold water please.", focus: "Natural rhythm" },
    { text: "He put the bag on the table.", focus: "Short vowels" },
    { text: "They like to watch films on the weekend.", focus: "Basic fluency" },
    { text: "Can I have a cup of coffee?", focus: "Question intonation" },
    { text: "The bus is late again today.", focus: "Basic vowels" },
    { text: "She reads a book before she sleeps.", focus: "Connected speech" },
    { text: "We had lunch at a small café.", focus: "Natural rhythm" },
    { text: "My dog loves to run in the garden.", focus: "Basic fluency" },
    { text: "He smiled and said hello to her.", focus: "L sounds" },
    { text: "I need to go to the bank today.", focus: "Basic vowels" },
    { text: "She cooked dinner for the whole family.", focus: "Connected speech" },
    { text: "The children are playing outside.", focus: "Natural rhythm" },
    { text: "Do you want some more tea?", focus: "Question intonation" },
    { text: "It was a cold and windy morning.", focus: "Basic fluency" },
    { text: "He called his mother on the phone.", focus: "L sounds" },
    { text: "They walked home together after school.", focus: "Connected speech" },
    { text: "I opened the window to let in fresh air.", focus: "Natural rhythm" },
    { text: "She put her keys on the kitchen counter.", focus: "Short vowels" },
    { text: "We arrived at the station just in time.", focus: "Basic fluency" },
  ],
  intermediate: [
    { text: "The weather today is particularly pleasant.", focus: "W + TH sounds" },
    { text: "I would rather stay home than go shopping.", focus: "TH sounds" },
    { text: "She was comfortable with the new arrangement.", focus: "Schwa sound" },
    { text: "Three thin thieves thought they threw three things.", focus: "TH sounds" },
    { text: "Could you please pass the butter and bread?", focus: "Polite requests" },
    { text: "I thoroughly enjoy reading books in the evening.", focus: "TH + rhythm" },
    { text: "They thought through the problem very carefully.", focus: "TH sounds" },
    { text: "The temperature dropped throughout the northern regions.", focus: "TH clusters" },
    { text: "Understanding grammar rules helps you speak fluently.", focus: "Connected speech" },
    { text: "She specifically requested a thoroughly reviewed report.", focus: "Word stress" },
    { text: "The library closes early on Thursday evenings.", focus: "TH sounds" },
    { text: "He thought about whether to accept the offer.", focus: "TH sounds" },
    { text: "The photographer captured a beautiful landscape image.", focus: "Word stress" },
    { text: "Although it was raining, they decided to walk.", focus: "Connected speech" },
    { text: "She breathed deeply before starting her presentation.", focus: "TH + schwa" },
    { text: "The further you travel, the more you learn.", focus: "TH sounds" },
    { text: "He would rather have coffee than tea this morning.", focus: "TH + rhythm" },
    { text: "I found the information particularly interesting and useful.", focus: "Word stress" },
    { text: "They celebrated their anniversary at a wonderful restaurant.", focus: "Schwa sound" },
    { text: "The athlete trained enthusiastically for the competition.", focus: "Word stress" },
    { text: "Everything seemed perfectly normal until the lights went out.", focus: "Connected speech" },
    { text: "She thanked them for their thoughtful and generous gift.", focus: "TH sounds" },
    { text: "The thirteenth chapter was the most challenging to understand.", focus: "TH sounds" },
    { text: "I think therefore I am is a famous philosophical statement.", focus: "TH sounds" },
    { text: "The southern climate is warmer than the northern regions.", focus: "TH + schwa" },
    { text: "He thoroughly enjoyed the theatrical performance last night.", focus: "TH sounds" },
    { text: "She managed to finish her assignment ahead of schedule.", focus: "Word stress" },
    { text: "The company announced significant changes to their travel policy.", focus: "Connected speech" },
    { text: "I would like to thank you for your patience and understanding.", focus: "TH sounds" },
    { text: "The rhythm of the music made everyone want to dance.", focus: "Rhythm + stress" },
  ],
  advanced: [
    { text: "Whether the weather be fine or whether the weather be not.", focus: "W + TH connected" },
    { text: "Rural jurors were regularly referred to a larger court.", focus: "R sounds" },
    { text: "She sells seashells by the seashore every summer.", focus: "S and SH sounds" },
    { text: "How much wood would a woodchuck chuck if a woodchuck could chuck wood?", focus: "W sounds" },
    { text: "Peter Piper picked a peck of pickled peppers.", focus: "P sounds" },
    { text: "The prerequisite for success is persistent perseverance.", focus: "Consonant clusters" },
    { text: "Red lorry yellow lorry red lorry yellow lorry.", focus: "L and R sounds" },
    { text: "The sixth sick sheik's sixth sheep is sick.", focus: "S + consonant clusters" },
    { text: "Unique New York you know you need unique New York.", focus: "NY sounds" },
    { text: "Freshly fried fresh flesh fish freshly fried with fresh fries.", focus: "FR + SH sounds" },
    { text: "The world woke up wondering what would warrant such worry.", focus: "W sounds" },
    { text: "Correctly articulated words rarely require repeated rehearsal.", focus: "R sounds" },
    { text: "She stood at the shore and stared at the shimmering stars.", focus: "S and SH sounds" },
    { text: "The pronunciation of Worcester and Leicester puzzles foreigners.", focus: "Silent letters" },
    { text: "Vulnerability requires courage and a willingness to be visible.", focus: "Complex stress" },
    { text: "The revolutionary rhetoric resonated with rural residents everywhere.", focus: "R sounds" },
    { text: "She swiftly switched between languages without losing stride.", focus: "S + W sounds" },
    { text: "Particularly perpendicular pillars of prehistoric proportions.", focus: "P + complex stress" },
    { text: "The vivid violet vista vanished virtually overnight.", focus: "V sounds" },
    { text: "Crisp Christmas crackers create crumbs across the carpet.", focus: "CR clusters" },
    { text: "Specifically speaking sophisticated speakers stress syllables strategically.", focus: "Complex stress" },
    { text: "The rhythm and rhyme of the rhetoric was rather remarkable.", focus: "R + rhythm" },
    { text: "Wavelengths of light vary vastly across the visible spectrum.", focus: "V + W sounds" },
    { text: "Shrewd investors seldom suffer serious financial setbacks.", focus: "S + SH sounds" },
    { text: "The struggling student persistently practised pronunciation principles.", focus: "Consonant clusters" },
    { text: "Frowning clowns crowned brown cows in the downtown square.", focus: "OW sounds" },
    { text: "Lesser leather never weathered wetter weather better.", focus: "L + W + TH sounds" },
    { text: "The strength required to reach the threshold surprised researchers.", focus: "TH + consonant clusters" },
    { text: "Presupposing preliminary prerequisites proves practically preposterous.", focus: "PRE + complex stress" },
    { text: "Extraordinary circumstances occasionally require extraordinary measures of strength.", focus: "Complex stress rhythm" },
  ],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STATUS = {
  correct: { bg: "rgba(34,197,94,0.18)",  color: "#15803d", border: "rgba(34,197,94,0.45)"  },
  close:   { bg: "rgba(234,179,8,0.18)",   color: "#b45309", border: "rgba(234,179,8,0.45)"  },
  wrong:   { bg: "rgba(239,68,68,0.18)",   color: "#dc2626", border: "rgba(239,68,68,0.45)"  },
  missed:  { bg: "rgba(148,163,184,0.18)", color: "#64748b", border: "rgba(148,163,184,0.4)" },
};

const DIFF_LABELS = {
  beginner:     "🌱 Beginner",
  intermediate: "🌿 Intermediate",
  advanced:     "🌳 Advanced",
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function PronunciationTab({ isDarkMode }) {
  const [difficulty,      setDifficulty]      = useState("beginner");
  const [pool,            setPool]            = useState(() => shuffle(LOCAL_SENTENCES.beginner));
  const [sentenceIdx,     setSentenceIdx]     = useState(0);
  // phase: ready | recording | analysing | result
  const [phase,           setPhase]           = useState("ready");
  const [result,          setResult]          = useState(null);
  const [scores,          setScores]          = useState([]);
  const [wordResults,     setWordResults]     = useState({});
  const [isFetching,      setIsFetching]      = useState(false);
  const [fetchStatus,     setFetchStatus]     = useState(null);
  const [noMicPermission, setNoMicPermission] = useState(false);
  const [analyseError,    setAnalyseError]    = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const audioCtxRef      = useRef(null);
  const analyserRef      = useRef(null);
  const canvasRef        = useRef(null);
  const animFrameRef     = useRef(null);
  const mountedRef       = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close().catch(() => {});
      window.speechSynthesis?.cancel();
    };
  }, []);

  const sentence = pool[sentenceIdx];

  const col = {
    card:    isDarkMode ? "#1e293b" : "#ffffff",
    border:  isDarkMode ? "#334155" : "#fed7aa",
    heading: isDarkMode ? "#f8fafc" : "#1e293b",
    body:    isDarkMode ? "#cbd5e1" : "#475569",
    sub:     isDarkMode ? "#94a3b8" : "#9ca3af",
    tip:     isDarkMode ? "rgba(139,92,246,0.12)" : "#faf5ff",
    tipBdr:  isDarkMode ? "#4c1d95"               : "#e9d5ff",
    progBg:  isDarkMode ? "#0f172a"               : "#f1f5f9",
    ipaBg:   isDarkMode ? "rgba(255,255,255,0.04)" : "#f8faff",
  };

  // ── Text-to-speech ─────────────────────────────────────────────────────────
  const speakSentence = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(sentence.text);
    utt.lang  = "en-US";
    utt.rate  = 0.82;
    window.speechSynthesis.speak(utt);
  };

  // ── Fetch AI sentences from backend ───────────────────────────────────────
  const fetchAISentences = useCallback(async (diff) => {
    if (!mountedRef.current) return null;
    setIsFetching(true);
    setFetchStatus(null);
    try {
      const { data } = await api.get(`/pronunciation/sentences?difficulty=${diff}`);
      if (data.success && data.sentences?.length > 0) {
        if (mountedRef.current) setFetchStatus("ok");
        return data.sentences;
      }
    } catch (err) {
      console.warn("Pronunciation fetch failed:", err.message);
    } finally {
      if (mountedRef.current) setIsFetching(false);
    }
    if (mountedRef.current) setFetchStatus("fallback");
    return null;
  }, []);

  // ── Live waveform ──────────────────────────────────────────────────────────
  const drawWaveform = useCallback((analyser) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const bufLen = analyser.frequencyBinCount;
    const data   = new Uint8Array(bufLen);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = "#ef4444";
      ctx.beginPath();
      const sliceW = canvas.width / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = data[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  }, []);

  // ── Send audio to server for analysis ─────────────────────────────────────
  const analyseAudio = useCallback(async (blob) => {
    setAnalyseError(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("targetText", sentence.text);

      const { data } = await api.post("/pronunciation/analyze", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!mountedRef.current) return;

      if (data.success) {
        setResult({ percentage: data.percentage, words: data.words, transcript: data.transcript });
        setScores(prev => [...prev, data.percentage]);
        setWordResults(prev => ({ ...prev, [sentenceIdx]: data.percentage }));
        setPhase("result");
      } else {
        setAnalyseError("Analysis failed. Please try again.");
        setPhase("ready");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      if (mountedRef.current) {
        setAnalyseError("Could not reach the server. Please try again.");
        setPhase("ready");
      }
    }
  }, [sentence, sentenceIdx]);

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setAnalyseError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Waveform visualiser
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        audioCtxRef.current?.close().catch(() => {});

        const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        if (mountedRef.current) await analyseAudio(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setPhase("recording");
      setResult(null);

      // Slight delay so canvas has mounted before drawing starts
      setTimeout(() => drawWaveform(analyser), 60);

    } catch (err) {
      console.error("Microphone error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setNoMicPermission(true);
      } else {
        setAnalyseError("Could not access microphone. Please check browser permissions.");
      }
    }
  }, [analyseAudio, drawWaveform]);

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setPhase("analysing");
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const nextSentence = async () => {
    const isLast = sentenceIdx >= pool.length - 1;
    if (isLast) {
      const aiSentences = await fetchAISentences(difficulty);
      if (aiSentences) {
        const newPool = [...pool, ...shuffle(aiSentences)];
        setPool(newPool);
        setSentenceIdx(sentenceIdx + 1);
      } else {
        setPool(shuffle([...LOCAL_SENTENCES[difficulty]]));
        setSentenceIdx(0);
        setWordResults({});
      }
    } else {
      setSentenceIdx(sentenceIdx + 1);
    }
    setPhase("ready");
    setResult(null);
    setAnalyseError(null);
  };

  const tryAgain = () => { setPhase("ready"); setResult(null); setAnalyseError(null); };

  const goTo = (idx) => {
    setSentenceIdx(idx);
    setPhase("ready");
    setResult(null);
    setAnalyseError(null);
  };

  const changeDifficulty = (d) => {
    setDifficulty(d);
    setPool(shuffle([...LOCAL_SENTENCES[d]]));
    setSentenceIdx(0);
    setPhase("ready");
    setResult(null);
    setScores([]);
    setWordResults({});
    setFetchStatus(null);
    setAnalyseError(null);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const avgScore   = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const greatCount = scores.filter(s => s >= 80).length;
  const progress   = Math.round(((sentenceIdx + 1) / pool.length) * 100);

  const ringGrad = result
    ? result.percentage >= 80 ? "linear-gradient(135deg,#22c55e,#4ade80)"
    : result.percentage >= 50 ? "linear-gradient(135deg,#f97316,#fb923c)"
    : "linear-gradient(135deg,#ef4444,#f87171)"
    : "";

  const scoreLabel = result
    ? result.percentage >= 90 ? "🏆 Excellent!"
    : result.percentage >= 75 ? "🎉 Great job!"
    : result.percentage >= 55 ? "👍 Keep going!"
    : "💪 Try again!" : "";

  const ipaCards = result?.words?.filter(w => w.status !== "correct" && w.ipa) ?? [];

  // ── No mic permission screen ───────────────────────────────────────────────
  if (noMicPermission) return (
    <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "Nunito, sans-serif" }}>
      <div style={{ fontSize: "52px", marginBottom: "16px" }}>🎙️</div>
      <h3 style={{ color: col.heading, margin: "0 0 8px" }}>Microphone Access Denied</h3>
      <p style={{ color: col.sub, maxWidth: "340px", margin: "0 auto 20px", fontSize: "14px", lineHeight: 1.6 }}>
        Please allow microphone access in your browser settings and reload the page to use pronunciation practice.
      </p>
      <button onClick={() => setNoMicPermission(false)}
        style={{ background: "linear-gradient(135deg,#f97316,#fb923c)", border: "none", borderRadius: "12px", padding: "10px 24px", color: "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: "14px" }}>
        Try Again
      </button>
    </div>
  );

  // ── AI sentence loading screen ─────────────────────────────────────────────
  if (isFetching) return (
    <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "Nunito, sans-serif" }}>
      <div style={{ fontSize: "52px", marginBottom: "16px", animation: "spin 1.2s linear infinite", display: "inline-block" }}>✨</div>
      <h3 style={{ color: col.heading, margin: "0 0 8px" }}>Generating new sentences…</h3>
      <p style={{ color: col.sub, fontSize: "14px" }}>AI is creating fresh practice material for you</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: "Nunito, sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", padding: "4px 0 0" }}>
        <h2 style={{ margin: 0, fontSize: "26px", fontWeight: 900, color: col.heading }}>
          🎤 Pronunciation Practice
        </h2>
        <p style={{ margin: "6px 0 0", color: col.sub, fontSize: "14px" }}>
          Record yourself and get phoneme-level feedback powered by AI
        </p>
      </div>

      {/* ── Status banners ────────────────────────────────────────────────── */}
      {fetchStatus === "ok" && (
        <div style={{ background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.35)", borderRadius: "12px", padding: "10px 16px", color: "#15803d", fontWeight: 700, fontSize: "13px", textAlign: "center" }}>
          ✨ New AI-generated sentences added to your practice pool!
        </div>
      )}
      {fetchStatus === "fallback" && (
        <div style={{ background: "rgba(249,115,22,0.1)", border: "2px solid rgba(249,115,22,0.3)", borderRadius: "12px", padding: "10px 16px", color: "#c2410c", fontWeight: 700, fontSize: "13px", textAlign: "center" }}>
          📚 Restarting with a fresh shuffle of your sentence bank
        </div>
      )}
      {analyseError && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)", borderRadius: "12px", padding: "10px 16px", color: "#dc2626", fontWeight: 700, fontSize: "13px", textAlign: "center" }}>
          ⚠️ {analyseError}
        </div>
      )}

      {/* ── Session stats ──────────────────────────────────────────────────── */}
      {scores.length > 0 && (
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { label: "Attempts",  value: scores.length,  grad: "linear-gradient(135deg,#f97316,#fb923c)" },
            { label: "Avg Score", value: `${avgScore}%`, grad: "linear-gradient(135deg,#22c55e,#4ade80)" },
            { label: "80%+ Runs", value: greatCount,     grad: "linear-gradient(135deg,#8b5cf6,#a78bfa)" },
          ].map(({ label, value, grad }) => (
            <div key={label} style={{ background: grad, borderRadius: "16px", padding: "10px 22px", color: "#fff", textAlign: "center", minWidth: "86px", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
              <div style={{ fontSize: "22px", fontWeight: 900 }}>{value}</div>
              <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Difficulty selector ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
        {Object.entries(DIFF_LABELS).map(([key, label]) => {
          const active = difficulty === key;
          return (
            <button key={key} onClick={() => changeDifficulty(key)} style={{
              padding: "8px 20px", borderRadius: "20px",
              border: `2px solid ${active ? "#f97316" : col.border}`,
              background: active ? "linear-gradient(135deg,#f97316,#fb923c)" : col.card,
              color: active ? "#fff" : col.body,
              fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif",
              fontSize: "13px", transition: "all 0.2s",
            }}>{label}</button>
          );
        })}
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: col.sub }}>
            Sentence {sentenceIdx + 1} of {pool.length}
            {pool.length > LOCAL_SENTENCES[difficulty].length && " (incl. AI sentences)"}
          </span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#f97316" }}>{progress}% through set</span>
        </div>
        <div style={{ background: col.progBg, borderRadius: "99px", height: "8px", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(90deg,#f97316,#fb923c)", height: "100%", width: `${progress}%`, borderRadius: "99px", transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* ── Main sentence card ─────────────────────────────────────────────── */}
      <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "32px 28px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", textAlign: "center" }}>

        {/* Focus label */}
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#f97316", marginBottom: "12px", letterSpacing: "0.8px", textTransform: "uppercase" }}>
          {sentence.focus}
        </div>

        {/* Sentence text — plain or word-coloured after result */}
        <div style={{ fontSize: "24px", fontWeight: 800, lineHeight: 1.7, color: col.heading, marginBottom: "20px", minHeight: "70px" }}>
          {result ? (
            result.words.map((w, i) => {
              const s = STATUS[w.status];
              return (
                <span key={i} style={{ display: "inline-block", margin: "3px 3px" }}>
                  <span style={{ background: s.bg, color: s.color, border: `2px solid ${s.border}`, borderRadius: "8px", padding: "2px 8px", display: "inline-block" }}>
                    {w.expected}
                    {(w.status === "wrong" || w.status === "close") && w.spoken && (
                      <span style={{ fontSize: "10px", display: "block", opacity: 0.85 }}>you: "{w.spoken}"</span>
                    )}
                    {w.status === "missed" && (
                      <span style={{ fontSize: "10px", display: "block", opacity: 0.75 }}>missed</span>
                    )}
                  </span>
                </span>
              );
            })
          ) : (
            <span>{sentence.text}</span>
          )}
        </div>

        {/* Whisper transcript */}
        {result?.transcript && (
          <div style={{ background: isDarkMode ? "rgba(59,130,246,0.10)" : "#eff6ff", border: "1.5px solid rgba(59,130,246,0.3)", borderRadius: "10px", padding: "8px 14px", marginBottom: "16px", fontSize: "13px", color: isDarkMode ? "#93c5fd" : "#1d4ed8", fontWeight: 600 }}>
            AI heard: "{result.transcript}"
          </div>
        )}

        {/* Hear button */}
        <button onClick={speakSentence} style={{ background: "transparent", border: `2px solid ${col.border}`, borderRadius: "12px", padding: "7px 18px", color: col.body, cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: "13px", fontWeight: 700, marginBottom: "28px" }}>
          🔊 Hear correct pronunciation
        </button>

        {/* ── READY ─────────────────────────────────────────────────────────── */}
        {phase === "ready" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <button
              onClick={startRecording}
              style={{ background: "linear-gradient(135deg,#f97316,#fb923c)", border: "none", borderRadius: "50%", width: "84px", height: "84px", fontSize: "34px", cursor: "pointer", boxShadow: "0 6px 24px rgba(249,115,22,0.45)", transition: "transform 0.15s, box-shadow 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(249,115,22,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)";   e.currentTarget.style.boxShadow = "0 6px 24px rgba(249,115,22,0.45)"; }}
            >🎤</button>
            <span style={{ color: col.sub, fontSize: "13px", fontWeight: 700 }}>Tap to start recording</span>
          </div>
        )}

        {/* ── RECORDING ─────────────────────────────────────────────────────── */}
        {phase === "recording" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
            <canvas
              ref={canvasRef}
              width={320} height={56}
              style={{ borderRadius: "10px", background: isDarkMode ? "rgba(239,68,68,0.06)" : "#fff5f5", border: "2px solid rgba(239,68,68,0.22)", display: "block" }}
            />
            <div style={{ position: "relative", width: "84px", height: "84px" }}>
              <div style={{ position: "absolute", inset: "-8px", borderRadius: "50%", border: "3px solid rgba(239,68,68,0.35)", animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite" }} />
              <button onClick={stopRecording} style={{ width: "84px", height: "84px", borderRadius: "50%", background: "linear-gradient(135deg,#ef4444,#f87171)", border: "none", fontSize: "28px", cursor: "pointer", boxShadow: "0 6px 20px rgba(239,68,68,0.45)" }}>⏹️</button>
            </div>
            <div style={{ color: "#ef4444", fontWeight: 800, fontSize: "14px" }}>🔴 Recording… tap stop when you're done</div>
          </div>
        )}

        {/* ── ANALYSING ─────────────────────────────────────────────────────── */}
        {phase === "analysing" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
            <div style={{ fontSize: "48px", animation: "spin 1s linear infinite", display: "inline-block" }}>✨</div>
            <div style={{ color: col.body, fontWeight: 800, fontSize: "15px" }}>Analysing your pronunciation…</div>
            <div style={{ color: col.sub, fontSize: "12px" }}>Powered by OpenAI Whisper</div>
          </div>
        )}

        {/* ── RESULT ────────────────────────────────────────────────────────── */}
        {phase === "result" && result && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" }}>
            {/* Score ring */}
            <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: ringGrad, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
              <div style={{ fontSize: "28px", fontWeight: 900 }}>{result.percentage}%</div>
              <div style={{ fontSize: "10px", opacity: 0.9 }}>Score</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: "17px", color: col.heading }}>{scoreLabel}</div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
              {[["✅ Correct", STATUS.correct], ["🟡 Close", STATUS.close], ["❌ Wrong", STATUS.wrong], ["⬜ Missed", STATUS.missed]].map(([lbl, s]) => (
                <div key={lbl} style={{ background: s.bg, color: s.color, border: `2px solid ${s.border}`, borderRadius: "8px", padding: "4px 12px", fontSize: "12px", fontWeight: 700 }}>{lbl}</div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={speakSentence} style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "12px", padding: "10px 18px", color: col.body, cursor: "pointer", fontWeight: 800, fontFamily: "Nunito, sans-serif", fontSize: "14px" }}>🔊 Hear it again</button>
              <button onClick={tryAgain}      style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "12px", padding: "10px 18px", color: col.body, cursor: "pointer", fontWeight: 800, fontFamily: "Nunito, sans-serif", fontSize: "14px" }}>🔄 Try Again</button>
              <button onClick={nextSentence}  style={{ background: "linear-gradient(135deg,#f97316,#fb923c)", border: "none", borderRadius: "12px", padding: "10px 22px", color: "#fff", cursor: "pointer", fontWeight: 800, fontFamily: "Nunito, sans-serif", fontSize: "14px", boxShadow: "0 4px 14px rgba(249,115,22,0.35)" }}>
                {sentenceIdx >= pool.length - 1 ? "✨ Get New Sentences" : "Next Sentence →"}
              </button>
            </div>

            {/* IPA correction cards */}
            {ipaCards.length > 0 && (
              <div style={{ width: "100%", maxWidth: "480px", textAlign: "left" }}>
                <div style={{ fontSize: "12px", fontWeight: 800, color: col.sub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
                  🔤 Pronunciation Guide
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {ipaCards.map((w, i) => {
                    const s = STATUS[w.status];
                    return (
                      <div key={i} style={{ background: col.ipaBg, border: `2px solid ${s.border}`, borderRadius: "12px", padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: w.tip ? "6px" : 0 }}>
                          <span style={{ fontWeight: 900, fontSize: "16px", color: s.color }}>{w.expected}</span>
                          <span style={{ fontSize: "15px", color: col.body, fontFamily: "'Courier New', monospace", fontWeight: 700 }}>{w.ipa}</span>
                          {w.spoken && (
                            <span style={{ fontSize: "12px", color: col.sub }}>you said: "<em>{w.spoken}</em>"</span>
                          )}
                        </div>
                        {w.tip && (
                          <p style={{ margin: 0, fontSize: "12px", color: col.body, lineHeight: 1.55 }}>{w.tip}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dot navigation ────────────────────────────────────────────────── */}
      {pool.length <= 20 && (
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
          {pool.map((_, i) => {
            const done  = wordResults[i] !== undefined;
            const score = wordResults[i];
            const bg = i === sentenceIdx ? "#f97316"
              : done ? score >= 80 ? "rgba(34,197,94,0.25)" : score >= 50 ? "rgba(234,179,8,0.25)" : "rgba(239,68,68,0.2)"
              : col.card;
            const borderC = i === sentenceIdx ? "#f97316"
              : done ? score >= 80 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444"
              : col.border;
            return (
              <button key={i} onClick={() => goTo(i)} style={{ width: "34px", height: "34px", borderRadius: "50%", border: `2px solid ${borderC}`, background: bg, color: i === sentenceIdx ? "#fff" : col.body, cursor: "pointer", fontWeight: 800, fontFamily: "Nunito, sans-serif", fontSize: "12px", transition: "all 0.2s" }}>
                {done ? (score >= 80 ? "✓" : score >= 50 ? "~" : "✗") : i + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tips ───────────────────────────────────────────────────────────── */}
      <div style={{ background: col.tip, border: `2px solid ${col.tipBdr}`, borderRadius: "16px", padding: "16px 20px" }}>
        <div style={{ fontWeight: 900, color: "#7c3aed", marginBottom: "8px", fontSize: "14px" }}>💡 Tips for better scores</div>
        <ul style={{ margin: 0, paddingLeft: "18px", color: col.body, fontSize: "13px", lineHeight: 1.9 }}>
          <li>Tap <strong>🔊 Hear it</strong> first to learn the correct rhythm and sounds</li>
          <li>Speak at a <strong>natural pace</strong> — not too fast, not too slow</li>
          <li><strong>Yellow</strong> words were almost right — small improvement needed</li>
          <li>The <strong>🔤 Pronunciation Guide</strong> shows IPA and tips for each missed word</li>
          <li>Works best in <strong>Chrome or Edge</strong> — Safari may have limited support</li>
        </ul>
      </div>

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
