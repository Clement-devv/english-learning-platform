import { useState, useRef, useCallback, useEffect } from "react";
import { useUploadQueue } from "../context/UploadQueueContext.jsx";

export function useRecording(bookingId) {
  const [isRecording,    setIsRecording]    = useState(false);
  const [recSeconds,     setRecSeconds]     = useState(0);
  const [recordingError, setRecordingError] = useState(null);
  const [memoryWarning,  setMemoryWarning]  = useState(false); // true when starting a new rec while one is uploading

  const { addToQueue, hasActiveUploads } = useUploadQueue();

  // Keep uploadingRecording as a derived alias so existing classroom UI
  // that reads it still compiles — it now reflects the global queue instead
  // of a local state.
  const uploadingRecording = hasActiveUploads;

  // Ref so startRecording can read the latest value without being recreated
  // every time an upload starts/finishes (avoids stale closure).
  const hasActiveUploadsRef = useRef(false);
  useEffect(() => { hasActiveUploadsRef.current = hasActiveUploads; }, [hasActiveUploads]);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const tabStreamRef     = useRef(null);
  const micStreamRef     = useRef(null);
  const audioCtxRef      = useRef(null);
  const recTimerRef      = useRef(null);
  const recSecondsRef    = useRef(0);

  useEffect(() => { recSecondsRef.current = recSeconds; }, [recSeconds]);

  const handleRecordingStop = useCallback((mimeType) => {
    // Strip codec params — some browsers fall back to text/plain when codecs are present
    const blobType = mimeType.split(";")[0].trim() || "video/webm";
    const blob = new Blob(chunksRef.current, { type: blobType });
    chunksRef.current = [];

    if (!bookingId) {
      console.warn("[useRecording] dropped — bookingId missing", { blobSize: blob.size });
      setRecordingError("Recording not saved: class ID missing. Please leave and rejoin.");
      return;
    }
    if (blob.size < 1000) {
      console.warn("[useRecording] dropped — blob too small", { blobSize: blob.size });
      setRecordingError("Recording not saved: no video data captured. Select the correct tab when prompted.");
      return;
    }

    setRecordingError(null);
    const ext = blobType.includes("mp4") ? ".mp4" : ".webm";
    // Hand off to the global queue — upload runs in background regardless of
    // which page the teacher navigates to next.
    addToQueue(blob, bookingId, recSecondsRef.current, ext);
  }, [bookingId, addToQueue]);

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
      chunksRef.current    = [];

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
      const recordStream = new MediaStream([
        ...tabStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(recordStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => handleRecordingStop(mimeType);

      // If teacher stops tab-share from the browser bar, stop the recorder too
      tabStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        console.error("Recording start error:", err);
      }
    }
  }, [handleRecordingStop]);

  const stopRecording = useCallback(() => {
    clearInterval(recTimerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.addEventListener("stop", () => {
        tabStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        audioCtxRef.current?.close();
        micStreamRef.current = null;
        audioCtxRef.current  = null;
      }, { once: true });
      mediaRecorderRef.current.stop();
    } else {
      tabStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
      micStreamRef.current = null;
      audioCtxRef.current  = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      tabStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
      clearInterval(recTimerRef.current);
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
