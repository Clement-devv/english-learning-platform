// src/components/groupClass/GroupClassRecorder.jsx
// Teacher's recording controls for a group class — same recorder as one-to-one
// classes (hooks/useRecording: browser share picker + the teacher's mic, saved in
// parts that upload while the class runs). Recordings are filed under the group
// class and enrolled students can watch them once the teacher shares them.
//   dark      — styling for the in-app Agora room
//   allowLink — Meet / Zoom: also "Save recording link" (their own cloud recording)
//   canRecord — false after the class: only the saved link is offered
//   captureThisTab — the in-app Agora room: record this tab itself, not a picked tab / screen
//   commandsRef — parent can call commandsRef.current.stop() (e.g. before leaving)
import { useEffect, useState } from "react";
import { Circle, Square, Loader2, Link2, X } from "lucide-react";
import api from "../../api";
import { useRecording } from "../../hooks/useRecording";

export default function GroupClassRecorder({ groupClassId, dark = false, allowLink = false, canRecord = true, captureThisTab = false, commandsRef, onStateChange }) {
  const {
    isRecording, uploadingRecording, recSeconds, recordingError, setRecordingError,
    startRecording, stopRecording, formatRecTime,
  } = useRecording(`group:${groupClassId}`, { captureThisTab });
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [linkMsg, setLinkMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (commandsRef) commandsRef.current = { stop: stopRecording }; }, [commandsRef, stopRecording]);
  useEffect(() => { onStateChange?.({ isRecording, uploadingRecording }); }, [isRecording, uploadingRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing the tab mid-recording would lose the last part
  useEffect(() => {
    if (!isRecording && !uploadingRecording) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRecording, uploadingRecording]);

  const saveLink = async () => {
    setSaving(true); setLinkMsg("");
    try {
      await api.post("/recordings/external", { groupClassId, url: link });
      setLinkMsg("Recording link saved"); setLink(""); setLinkOpen(false);
    } catch (e) {
      setLinkMsg(e.response?.data?.message || "Could not save the link");
    } finally { setSaving(false); }
  };

  const base = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" };
  const recBtn = isRecording
    ? { ...base, background: "#dc2626", color: "#fff" }
    : { ...base, background: dark ? "rgba(255,255,255,0.12)" : "#fef2f2", color: dark ? "#fff" : "#b91c1c" };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {(canRecord || isRecording || uploadingRecording) && <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={uploadingRecording}
          style={{ ...recBtn, opacity: uploadingRecording ? 0.6 : 1 }} title={isRecording ? "Stop recording" : "Record this class"}>
          {uploadingRecording ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
            : isRecording ? <Square size={12} fill="currentColor" /> : <Circle size={14} />}
          {uploadingRecording ? "Saving…" : isRecording ? `Stop · ${formatRecTime(recSeconds)}` : "Record"}
        </button>}
        {allowLink && !isRecording && (
          <button type="button" onClick={() => setLinkOpen((v) => !v)} style={{ ...base, background: dark ? "rgba(255,255,255,0.12)" : "#eff6ff", color: dark ? "#fff" : "#1d4ed8" }}>
            <Link2 size={14} /> Recording link
          </button>
        )}
      </div>
      {isRecording && !dark && (
        <span style={{ fontSize: 11.5, color: "#b45309" }}>Keep this page open while recording — choose the {allowLink ? "meeting" : "class"} tab when the browser asks what to share.</span>
      )}
      {linkOpen && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… (Zoom / Google Meet recording)"
            style={{ flex: 1, minWidth: 200, padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12.5, fontFamily: "inherit" }} />
          <button type="button" disabled={!link.trim() || saving} onClick={saveLink} style={{ ...base, background: "#1d4ed8", color: "#fff", opacity: !link.trim() || saving ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {(recordingError || linkMsg) && (
        <span role="status" style={{ fontSize: 11.5, color: recordingError ? "#dc2626" : "#059669", display: "inline-flex", gap: 6, alignItems: "center" }}>
          {recordingError || linkMsg}
          {recordingError && <button type="button" onClick={() => setRecordingError(null)} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}><X size={12} /></button>}
        </span>
      )}
    </div>
  );
}
