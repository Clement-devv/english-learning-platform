// src/pages/homework-link/HomeworkLinkPage.jsx
// Public page for a homework share link (managed students — no login).
// Flow: confirm student + teacher name → see homework → submit answer.
// Kid-friendly "hero mission" theme — shared kit in src/components/hero/.
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Clock, Paperclip, X, Send, Mic, FileText, Image as ImageIcon, Headphones, Pencil } from "lucide-react";
import api from "../../api";
import AudioRecorder from "../../components/AudioRecorder";
import { HERO, HERO_FONTS } from "../../components/hero/heroTheme";
import { StarBuddy, Celebration, PowBurst } from "../../components/hero/HeroScene";
import { HeroPage, HeroGate, HeroNotice, HeroLoading, useShareLinkSession } from "../../components/hero/HeroLinkKit";

// Photos and PDFs only (the server enforces the same list)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_VOICE_SECONDS = 180;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES     = 5;

// Re-draw photos through a canvas before upload: strips hidden metadata (EXIF,
// incl. GPS location of the child's home) and anything appended to the file,
// and shrinks big phone photos. Falls back to the original if the browser can't.
async function cleanImage(file) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale  = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fmtDateTime = (d) => new Date(d).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Homework-only styles (the shared ones live in HeroLinkKit)
const PAGE_CSS = `
.hl-file { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 8px 12px; border: 2px solid ${HERO.ink}; border-radius: 12px; background: #F4F8FF; font-size: 14px; font-weight: 600; }
.hl-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hl-recorder { --brand-primary: ${HERO.blue}; --brand-primary-rgb: 47, 123, 245; }
.hl-recorder > div { border-width: 2.5px !important; border-color: ${HERO.ink} !important; border-radius: 16px !important; background: #F4F8FF !important; }
.hl-recorder button { border: 2.5px solid ${HERO.ink} !important; border-radius: 14px !important; box-shadow: 3px 3px 0 ${HERO.ink}; padding: 10px 16px !important; font: 700 15px ${HERO_FONTS.heading} !important; transition: transform .08s, box-shadow .08s; }
.hl-recorder button:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 ${HERO.ink}; }
`;

export default function HomeworkLinkPage() {
  const { token } = useParams();
  const basePath = `/homework/link/${token}`;
  const s = useShareLinkSession({ basePath, dataKey: "homework", storageKey: `hwAccess:${token?.slice(0, 12)}` });

  return (
    <HeroPage extraCss={PAGE_CSS}>
      {s.phase === "loading" && <HeroLoading />}
      {s.phase === "invalid" && (
        <HeroNotice title="Oops! This link doesn't work"
          text={s.message || "This homework link is invalid or has been removed. Please ask your teacher for a new link."} />
      )}
      {s.phase === "expired" && (
        <HeroNotice title="This mission has ended"
          text={s.message || "The due date for this homework has passed. Ask your teacher if you still want to send it."} />
      )}
      {s.phase === "gate" && (
        <HeroGate unlockPath={`${basePath}/unlock`} subtitle="Your homework mission is waiting." onUnlocked={s.onUnlocked} onFailure={s.onFailure} />
      )}
      {s.phase === "view" && s.data && (
        <HomeworkView token={token} homework={s.data} setHomework={s.setData} headers={s.headers} onFailure={s.onFailure} />
      )}
    </HeroPage>
  );
}

function HomeworkView({ token, homework: hw, setHomework, headers, onFailure }) {
  const [text, setText]     = useState("");
  const [files, setFiles]   = useState([]);
  const [voice, setVoice]   = useState(null);   // { blob, duration } recorded answer
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [editing, setEditing]   = useState(!hw.submission);
  const [celebrate, setCelebrate] = useState(false);
  const [audioUrl, setAudioUrl]     = useState(null);
  const [myVoiceUrl, setMyVoiceUrl] = useState(null);
  const inputRef = useRef(null);
  const doneRef  = useRef(null);

  // After sending, bring the "mission complete" card into view
  useEffect(() => {
    if (celebrate) doneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [celebrate]);

  const graded = hw.status === "graded";

  // Fetch an access-checked file. S3 returns { url }; local storage returns the bytes.
  const fetchFileUrl = async (type, fileId) => {
    const { data } = await api.get(`/homework/link/${token}/file/${type}/${fileId}`, { headers: headers(), responseType: "blob" });
    return data.type === "application/json" ? JSON.parse(await data.text()).url : URL.createObjectURL(data);
  };

  const openFile = async (type, fileId) => {
    const win = window.open("", "_blank"); // open synchronously so mobile browsers don't block it
    try {
      const url = await fetchFileUrl(type, fileId);
      if (win) win.location.href = url; else window.location.href = url;
    } catch (err) {
      win?.close();
      if (!onFailure(err)) setError("Could not open the file. Please try again.");
    }
  };

  const loadAudio = async (type, fileId, set) => {
    try { set(await fetchFileUrl(type, fileId)); }
    catch (err) { if (!onFailure(err)) setError("Could not load the recording."); }
  };

  const addFiles = async (list) => {
    setError("");
    const next = [...files];
    for (const raw of list) {
      if (!ALLOWED_TYPES.includes(raw.type)) { setError(`"${raw.name}" can't be uploaded. Use a photo (JPG, PNG) or a PDF.`); continue; }
      if (next.length >= MAX_FILES) { setError(`You can add up to ${MAX_FILES} files.`); break; }
      const f = await cleanImage(raw);
      if (f.size > MAX_FILE_SIZE) { setError(`"${raw.name}" is bigger than 10 MB.`); continue; }
      next.push(f);
    }
    setFiles(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && files.length === 0 && !voice) { setError("Write your answer, record your voice, or add a photo."); return; }
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.append("text", text.trim());
      files.forEach(f => fd.append("files", f));
      if (voice?.blob) {
        const ext = voice.blob.type.includes("mp4") ? "m4a" : voice.blob.type.includes("ogg") ? "ogg" : "webm";
        fd.append("audio", voice.blob, `voice.${ext}`);
        fd.append("duration", String(voice.duration));
      }
      const { data } = await api.post(`/homework/link/${token}/submit`, fd, { headers: { ...headers(), "Content-Type": "multipart/form-data" } });
      setHomework(data.homework);
      setFiles([]); setText(""); setVoice(null); setMyVoiceUrl(null); setEditing(false);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 4500);
    } catch (err) {
      if (!onFailure(err)) setError(err?.response?.data?.message || "Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const hasBriefing = hw.description || hw.hasInstructionAudio || hw.attachments.length > 0;

  return (
    <>
      {celebrate && <Celebration />}

      {/* ── Mission header ── */}
      <section className="hl-card" style={{ position: "relative", overflow: "hidden" }}>
        <div className="hl-anim" style={{ position: "absolute", right: 14, top: 14, animation: "hl-bounce 2.2s ease-in-out infinite" }}>
          <StarBuddy size={56} />
        </div>
        {hw.centerName && (
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: HERO.inkSoft, paddingRight: 64 }}>
            {hw.centerName}
          </p>
        )}
        <p style={{ margin: "0 0 6px", fontFamily: HERO_FONTS.heading, fontWeight: 700, fontSize: 18, color: HERO.redDeep, paddingRight: 64 }}>
          Hi {hw.studentName}! 👋
        </p>
        <h1 className="hl-h1" style={{ paddingRight: 64 }}>{hw.title}</h1>
        <p className="hl-muted" style={{ margin: "12px 0 18px", fontSize: 16, lineHeight: 1.5 }}>
          A new mission from <strong style={{ color: HERO.ink }}>{hw.teacherName}</strong>
        </p>
        <span className="hl-chip"><Clock size={16} /> Due {fmtDate(hw.dueDate)}</span>
      </section>

      {/* ── Mission briefing ── */}
      {hasBriefing && (
        <section className="hl-card" style={{ animationDelay: ".08s" }}>
          <h2 className="hl-h2"><span className="hl-ico" style={{ background: HERO.sun }}>📜</span> Your mission</h2>
          {hw.description && (
            <p style={{ margin: "0 0 18px", fontSize: 17, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{hw.description}</p>
          )}
          {hw.hasInstructionAudio && (
            <div style={{ marginBottom: hw.attachments.length ? 16 : 0 }}>
              {audioUrl
                ? <audio src={audioUrl} controls autoPlay style={{ width: "100%" }} />
                : <button type="button" className="hl-btn hl-btn-sun" style={{ fontSize: 16, padding: "12px 18px" }}
                    onClick={() => loadAudio("instruction-audio", hw.instructionAudioId, setAudioUrl)}>
                    <Headphones size={18} /> Listen to your teacher
                  </button>}
            </div>
          )}
          {hw.attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {hw.attachments.map(a => (
                <button key={a.fileId} type="button" className="hl-btn hl-btn-soft" onClick={() => openFile("assignment", a.fileId)}>
                  {a.mimeType?.startsWith("image/") ? <ImageIcon size={16} /> : <FileText size={16} />}
                  <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.originalName}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Submitted ── */}
      {hw.submission && !editing && (
        <section ref={doneRef} className="hl-card" style={{ background: HERO.greenPale, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <PowBurst lines={graded ? ["ALL", "CHECKED!"] : ["MISSION", "DONE!"]} size={170} />
          </div>
          <p style={{ margin: "0 0 4px", fontFamily: HERO_FONTS.heading, fontWeight: 700, fontSize: 20 }}>
            {graded ? "Your teacher checked your work!" : "Great job, hero! Your homework was sent."}
          </p>
          <p className="hl-muted" style={{ margin: "0 0 18px", fontSize: 14 }}>Sent {fmtDateTime(hw.submission.submittedAt)}</p>

          <div style={{ textAlign: "left", background: "#fff", border: `2.5px solid ${HERO.ink}`, borderRadius: 16, padding: 16 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 14, color: HERO.inkSoft }}>What you sent</p>
            {hw.submission.text && <p style={{ margin: "0 0 12px", fontSize: 16, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{hw.submission.text}</p>}
            {hw.submission.audio && (
              <div style={{ marginBottom: 12 }}>
                {myVoiceUrl
                  ? <audio src={myVoiceUrl} controls autoPlay style={{ width: "100%" }} />
                  : <button type="button" className="hl-btn hl-btn-soft" onClick={() => loadAudio("submission-audio", hw.submission.audio.fileId, setMyVoiceUrl)}>
                      <Mic size={16} /> Play my recording
                    </button>}
              </div>
            )}
            {hw.submission.attachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {hw.submission.attachments.map(a => (
                  <button key={a.fileId} type="button" className="hl-btn hl-btn-soft" onClick={() => openFile("submission", a.fileId)}>
                    {a.mimeType?.startsWith("image/") ? <ImageIcon size={16} /> : <FileText size={16} />}
                    <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.originalName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {graded
            ? <p className="hl-muted" style={{ margin: "16px 0 0", fontSize: 15 }}>Your teacher will send your results to your parent.</p>
            : <button type="button" className="hl-btn hl-btn-soft" style={{ marginTop: 18 }} onClick={() => setEditing(true)}>
                <Pencil size={16} /> Change my answer
              </button>}
        </section>
      )}

      {/* ── Answer form ── */}
      {editing && !graded && (
        <form onSubmit={submit} className="hl-card" style={{ animationDelay: ".16s" }}>
          <h2 className="hl-h2"><span className="hl-ico" style={{ background: HERO.red, color: "#fff" }}>✏️</span> Your answer</h2>

          <label className="hl-label" htmlFor="hl-answer">Write here</label>
          <textarea id="hl-answer" className="hl-input" value={text} onChange={e => setText(e.target.value)}
            maxLength={5000} rows={6} placeholder="Type your answer…" style={{ resize: "vertical", lineHeight: 1.6 }} />

          <p className="hl-label" style={{ marginTop: 22 }}>Say it out loud <span className="hl-muted" style={{ fontWeight: 500 }}>(optional)</span></p>
          <div className="hl-recorder">
            <AudioRecorder
              label={null}
              recordLabel="Record my voice"
              maxSeconds={MAX_VOICE_SECONDS}
              onRecorded={(blob, duration) => setVoice(blob ? { blob, duration } : null)}
            />
          </div>
          <p className="hl-muted" style={{ margin: "8px 0 0", fontSize: 13 }}>Up to 3 minutes. Read your answer or practise speaking.</p>

          <p className="hl-label" style={{ marginTop: 22 }}>Add a photo <span className="hl-muted" style={{ fontWeight: 500 }}>(optional)</span></p>
          <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" style={{ display: "none" }}
            onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
          <button type="button" className="hl-btn hl-btn-sun" style={{ fontSize: 16, padding: "12px 18px" }} onClick={() => inputRef.current?.click()}>
            <Paperclip size={18} /> Add photo or PDF
          </button>
          <p className="hl-muted" style={{ margin: "8px 0 0", fontSize: 13 }}>A photo of your written work is perfect. Up to {MAX_FILES} files.</p>

          {files.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {files.map((f, i) => (
                <span key={i} className="hl-file">
                  {f.type.startsWith("image/") ? <ImageIcon size={15} /> : <FileText size={15} />}
                  <span>{f.name}</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: HERO.ink, display: "flex" }}>
                    <X size={15} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {hw.submission && <p className="hl-muted" style={{ margin: "18px 0 0", fontSize: 13 }}>Sending again replaces your last answer.</p>}
          {error && <p className="hl-error" role="alert">{error}</p>}

          <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
            {hw.submission && (
              <button type="button" className="hl-btn hl-btn-soft" style={{ flex: "1 1 120px" }} onClick={() => { setEditing(false); setError(""); }}>
                Cancel
              </button>
            )}
            <button type="submit" disabled={busy} className="hl-btn hl-btn-main" style={{ flex: "2 1 200px", width: "auto" }}>
              <Send size={19} /> {busy ? "Sending…" : "Send to my teacher!"}
            </button>
          </div>
        </form>
      )}

      {error && !editing && <p className="hl-error" role="alert">{error}</p>}
      <p style={{ margin: "4px 0 0", fontSize: 13, textAlign: "center", fontWeight: 600, color: HERO.ink, opacity: .75 }}>
        This link works until the end of {fmtDate(hw.dueDate)}.
      </p>
    </>
  );
}

