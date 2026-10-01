import { useState, useRef, useCallback, useEffect } from "react";
import { useUploadQueue } from "../context/UploadQueueContext.jsx";

// A long class is saved as consecutive parts of this length. Each part is a
// complete, playable file that uploads while the class continues, so a crash
// or closed tab loses at most one part instead of the whole class.
export const RECORDING_PART_SECONDS = 8 * 60;

const newSessionId = () =>
  (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`)
    .replace(/[^A-Za-z0-9_-]/g, "");

export function useRecording(bookingId) {
  const [isRecording,    setIsRecording]    = useState(false);
  const [recSeconds,     setRecSeconds]     = useState(0);
  const [recordingError, setRecordingError] = useState(null);
  const [memoryWarning,  setMemoryWarning]  = useState(false); // true when starting a new rec while one is uploading

  const { addToQueue, hasActiveUploads } = useUploadQueue();

  // Keep uploadingRecording as a derived alias so existing classroom UI
  // that reads it still compiles — it reflects the global queue. Parts upload
  // while recording continues, so it only counts once recording has stopped
  // (otherwise the Stop button would be disabled mid-class).
  const uploadingRecording = hasActiveUploads && !isRecording;

  // Ref so startRecording can read the latest value without being recreated
  // every time an upload starts/finishes (avoids stale closure).
  const hasActiveUploadsRef = useRef(false);
  useEffect(() => { hasActiveUploadsRef.current = hasActiveUploads; }, [hasActiveUploads]);

  const mediaRecorderRef = useRef(null);   // recorder for the current part
  const recordStreamRef  = useRef(null);   // tab video + mixed audio, shared by all parts
  const mimeTypeRef      = useRef("video/webm");
  const sessionRef       = useRef(null);   // { id, startedAt, nextPart }
  const partTimerRef     = useRef(null);
  const tabStreamRef     = useRef(null);
  const micStreamRef     = useRef(null);
  const audioCtxRef      = useRef(null);
  const recTimerRef      = useRef(null);
  const stopRecordingRef = useRef(() => {}); // latest stopRecording, for the share-ended handler

  const releaseStreams = useCallback(() => {
    tabStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    tabStreamRef.current    = null;
    micStreamRef.current    = null;
    audioCtxRef.current     = null;
    recordStreamRef.current = null;
  }, []);

  // A part has finished — hand it to the global upload queue
  const handlePartStop = useCallback((chunks, part) => {
    // Strip codec params — some browsers fall back to text/plain when codecs are present
    const blobType = mimeTypeRef.current.split(";")[0].trim() || "video/webm";
    const blob = new Blob(chunks, { type: blobType });

    if (!bookingId) {
      console.warn("[useRecording] dropped — bookingId missing", { blobSize: blob.size });
      setRecordingError("Recording not saved: class ID missing. Please leave and rejoin.");
      return;
    }
    if (blob.size < 1000) {
      console.warn("[useRecording] dropped — blob too small", { blobSize: blob.size, part: part.partNumber });
      // Only an empty *first* part means nothing was captured; a tiny last part
      // just means Stop was pressed right after a new part began.
      if (part.partNumber === 1) {
        setRecordingError("Recording not saved: no video data captured. Select the correct tab when prompted.");
      }
      return;
    }

    setRecordingError(null);
    const ext = blobType.includes("mp4") ? ".mp4" : ".webm";
    // Hand off to the global queue — upload runs in background regardless of
    // which page the teacher navigates to next.
    addToQueue(blob, bookingId, part.duration, ext, part);
  }, [bookingId, addToQueue]);

  // Start recording the next part on the shared stream. Returns the recorder.
  const startPart = useCallback(() => {
    const stream  = recordStreamRef.current;
    const session = sessionRef.current;
    if (!stream || !session) return null;

    const partNumber  = session.nextPart;
    const partStarted = Date.now();
    const chunks      = [];

    const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
    session.nextPart += 1;
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => handlePartStop(chunks, {
      sessionId:   session.id,
      partNumber,
      startOffset: Math.round((partStarted - session.startedAt) / 1000),
      duration:    Math.round((Date.now() - partStarted) / 1000),
    });
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    return recorder;
  }, [handlePartStop]);

  // Every RECORDING_PART_SECONDS: start the next part first, then stop the
  // previous one, so there is no gap between parts.
  const schedulePartRotation = useCallback(() => {
    clearTimeout(partTimerRef.current);
    partTimerRef.current = setTimeout(() => {
      const previous = mediaRecorderRef.current;
      if (previous?.state !== "recording") return;
      try {
        startPart();
      } catch (err) {
        // Couldn't open a new part — keep the current one running instead
        console.error("[useRecording] could not start next part", err);
        mediaRecorderRef.current = previous;
        schedulePartRotation();
        return;
      }
      previous.stop();
      schedulePartRotation();
    }, RECORDING_PART_SECONDS * 1000);
  }, [startPart]);

  const startRecording = useCallback(async () => {
    // Warn if a previous recording is still uploading — two large blobs in
    // memory simultaneously increases the risk of a tab crash on low-RAM devices.
    // Use ref to get the latest value without recreating this callback.
    if (hasActiveUploadsRef.current) setMemoryWarning(true);
    try {
      // 1. Capture the browser tab (video + tab audio output = student's voice)
      //    No preferCurrentTab — we want the full picker so the user can select
      //    the Google Meet tab (which opens in a separate tab).
      const tabStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: true,
      });
      tabStreamRef.current = tabStream;

      // 2. Mix in the teacher's microphone so both voices end up in the recording
      const audioCtx   = new AudioContext();
      audioCtxRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();

      // Tab audio (student's voice played back through the browser)
      const tabAudioTracks = tabStream.getAudioTracks();
      if (tabAudioTracks.length > 0) {
        const tabSource = audioCtx.createMediaStreamSource(new MediaStream(tabAudioTracks));
        tabSource.connect(destination);
      }

      // Microphone (teacher's voice) — optional, continue without if denied
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micStreamRef.current = micStream;
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(destination);
      } catch (_) {
        // Microphone access denied or unavailable — record without it
      }

      // 3. Build the recording stream: tab video + mixed audio
      recordStreamRef.current = new MediaStream([
        ...tabStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      mimeTypeRef.current = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      // 4. Record in parts: part 1 starts now, a new part every RECORDING_PART_SECONDS
      sessionRef.current = { id: newSessionId(), startedAt: Date.now(), nextPart: 1 };
      startPart();
      schedulePartRotation();

      // If teacher stops tab-share from the browser bar, stop recording too
      tabStream.getVideoTracks()[0].onended = () => stopRecordingRef.current();

      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        console.error("Recording start error:", err);
      }
      clearTimeout(partTimerRef.current);
      releaseStreams();
    }
  }, [startPart, schedulePartRotation, releaseStreams]);

  const stopRecording = useCallback(() => {
    clearInterval(recTimerRef.current);
    clearTimeout(partTimerRef.current);
    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    sessionRef.current = null;
    if (recorder?.state === "recording") {
      // Release the capture only after the last part has flushed its data
      recorder.addEventListener("stop", releaseStreams, { once: true });
      recorder.stop();
    } else {
      releaseStreams();
    }
  }, [releaseStreams]);

  useEffect(() => { stopRecordingRef.current = stopRecording; }, [stopRecording]);

  useEffect(() => {
    return () => {
      clearTimeout(partTimerRef.current);
      clearInterval(recTimerRef.current);
      // Stopping still fires onstop, so the last part is queued for upload
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      tabStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const formatRecTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return {
    isRecording,
    uploadingRecording,
    recSeconds,
    recordingError,
    memoryWarning,
    setRecordingError,
    setMemoryWarning,
    startRecording,
    stopRecording,
    formatRecTime,
  };
}
