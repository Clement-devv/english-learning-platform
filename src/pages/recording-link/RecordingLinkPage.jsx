// src/pages/recording-link/RecordingLinkPage.jsx
// Public page for a class video (managed students' families — no login).
// The family confirms the student's and teacher's names, then the class plays straight
// from storage: every part of a recording in order, one recording after another.
// Server: server/routes/recordingLinkRoutes.js, server/utils/recordingLinks.js.
import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Clock, UserRound, Film, ExternalLink, PlayCircle } from "lucide-react";
import api from "../../api";
import { HERO } from "../../components/hero/heroTheme";
import { HeroPage, HeroGate, HeroNotice, HeroLoading, useShareLinkSession } from "../../components/hero/HeroLinkKit";

const fmtWhen = (d) => new Date(d).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
const fmtDay = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

const PAGE_CSS = `
.rv-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 2px dashed #D5DBEF; font-size: 16px; }
.rv-row:last-child { border-bottom: none; }
.rv-video { width: 100%; border-radius: 16px; border: 3px solid ${HERO.ink}; background: #000; aspect-ratio: 16 / 9; display: block; }
.rv-parts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.rv-part { border: 2.5px solid ${HERO.ink}; border-radius: 999px; padding: 6px 14px; font-weight: 700; font-size: 14px; background: #fff; cursor: pointer; }
.rv-part[aria-current="true"] { background: ${HERO.blue}; color: #fff; }
`;

export default function RecordingLinkPage() {
  const { token } = useParams();
  const basePath = `/recording-links/link/${token}`;
  const s = useShareLinkSession({ basePath, dataKey: "video", storageKey: `rvAccess:${token?.slice(0, 12)}` });

  return (
    <HeroPage extraCss={PAGE_CSS}>
      {s.phase === "loading" && <HeroLoading text="Loading…" />}
      {s.phase === "invalid" && (
        <HeroNotice title="This link doesn't work" text={s.message || "This link is invalid or has been replaced. Please ask the school for a new link."} />
      )}
      {s.phase === "expired" && (
        <HeroNotice title="This video isn't available" text={s.message || "Videos are kept for 30 days after the class. Please contact the school if you need it."} />
      )}
      {s.phase === "gate" && (
        <HeroGate
          unlockPath={`${basePath}/unlock`}
          title="Class video"
          subtitle="Please confirm the names to watch the class."
          studentLabel="Your child's name"
          teacherLabel="Their teacher's name"
          buttonLabel="Watch the class"
          onUnlocked={s.onUnlocked}
          onFailure={s.onFailure}
        />
      )}
      {s.phase === "view" && s.data && (
        <VideoView basePath={basePath} video={s.data} setVideo={s.setData} headers={s.headers} onFailure={s.onFailure} />
      )}
    </HeroPage>
  );
}

/** Local-disk videos come back as an API path; S3 videos as a full https address. */
const playable = (url) => (/^https?:\/\//.test(url) ? url : `${api.defaults.baseURL || ""}${url}`);

function VideoView({ basePath, video, setVideo, headers, onFailure }) {
  const sessions = [];
  for (const v of video.videos || []) {
    (sessions[v.session - 1] ||= []).push(v);
  }
  const list = sessions.filter(Boolean);
  const [sessionIdx, setSessionIdx] = useState(0);
  const [partIdx, setPartIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const resumeAt = useRef(0);
  const playOnLoad = useRef(false);
  const videoRef = useRef(null);

  const parts = list[sessionIdx] || [];
  const current = parts[partIdx];

  // Video addresses are short-lived — on an error (e.g. paused a long time), fetch fresh ones once
  const onError = async () => {
    if (refreshing || current?.external) return;
    setRefreshing(true);
    resumeAt.current = videoRef.current?.currentTime || 0;
    try {
      const { data } = await api.get(basePath, { headers: headers() });
      setVideo(data.video);
    } catch (err) {
      onFailure(err);
    } finally {
      setTimeout(() => setRefreshing(false), 5000);
    }
  };

  const goTo = (s, p, autoplay = false) => { setSessionIdx(s); setPartIdx(p); resumeAt.current = 0; playOnLoad.current = autoplay; };
  // Next part of the same recording plays on its own
  const onEnded = () => { if (partIdx + 1 < parts.length) goTo(sessionIdx, partIdx + 1, true); };

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onLoaded = () => {
      if (resumeAt.current) { el.currentTime = resumeAt.current; resumeAt.current = 0; }
      if (playOnLoad.current) { playOnLoad.current = false; el.play().catch(() => {}); }
    };
    el.addEventListener("loadedmetadata", onLoaded);
    return () => el.removeEventListener("loadedmetadata", onLoaded);
  }, [current?.url]);

  return (
    <>
      <section className="hl-card" style={{ position: "relative" }}>
        {video.centerName && (
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: HERO.inkSoft }}>
            {video.centerName}
          </p>
        )}
        <h1 className="hl-h1" style={{ fontSize: 26 }}>{video.studentName}'s class</h1>
        <div style={{ marginTop: 14 }}>
          <div className="rv-row"><CalendarDays size={20} color={HERO.blue} /> <strong>{video.classTitle}</strong></div>
          {video.scheduledTime && (
            <div className="rv-row"><Clock size={20} color={HERO.sunDeep} /> {fmtWhen(video.scheduledTime)}{video.duration ? ` · ${video.duration} min` : ""}</div>
          )}
          <div className="rv-row"><UserRound size={20} color={HERO.green} /> Teacher: {video.teacherName}</div>
        </div>
      </section>

      <section className="hl-card" style={{ animationDelay: ".08s" }}>
        {list.length === 0 ? (
          <p className="hl-muted" style={{ margin: 0 }}>There is no video for this class yet.</p>
        ) : (
          <>
            {list.length > 1 && (
              <div className="rv-parts" style={{ marginTop: 0, marginBottom: 14 }} role="tablist" aria-label="Recordings">
                {list.map((_, i) => (
                  <button key={i} type="button" className="rv-part" role="tab" aria-current={i === sessionIdx} onClick={() => goTo(i, 0)}>
                    <Film size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Recording {i + 1}
                  </button>
                ))}
              </div>
            )}

            {current?.external ? (
              <div style={{ textAlign: "center", padding: "18px 0" }}>
                <p className="hl-muted" style={{ margin: "0 0 14px", fontSize: 15 }}>This class was recorded outside the app.</p>
                <a className="hl-btn hl-btn-main" href={current.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", gap: 8, width: "auto", textDecoration: "none" }}>
                  <ExternalLink size={18} /> Open the recording
                </a>
              </div>
            ) : current ? (
              <>
                <video
                  key={current.url}
                  ref={videoRef}
                  className="rv-video"
                  src={playable(current.url)}
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  onEnded={onEnded}
                  onError={onError}
                  onContextMenu={(e) => e.preventDefault()}
                />
                {parts.length > 1 && (
                  <>
                    <div className="rv-parts" role="tablist" aria-label="Parts">
                      {parts.map((p, i) => (
                        <button key={p.id} type="button" className="rv-part" role="tab" aria-current={i === partIdx} onClick={() => goTo(sessionIdx, i, true)}>
                          <PlayCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Part {i + 1}
                        </button>
                      ))}
                    </div>
                    <p className="hl-muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
                      The class was saved in {parts.length} parts — the next part starts by itself.
                    </p>
                  </>
                )}
              </>
            ) : null}
          </>
        )}
        {video.expiresAt && (
          <p className="hl-muted" style={{ margin: "16px 0 0", fontSize: 13, textAlign: "center" }}>
            Available until {fmtDay(video.expiresAt)}. Please keep this link to your family.
          </p>
        )}
      </section>
    </>
  );
}
