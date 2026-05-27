import { useState, useRef, useCallback, useEffect } from "react";

export function useRecording(bookingId) {
  const [isRecording,        setIsRecording]        = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const [recSeconds,         setRecSeconds]         = useState(0);
  const [recordingError,     setRecordingError]     = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const tabStreamRef     = useRef(null);
  const micStreamRef     = useRef(null);
  const audioCtxRef      = useRef(null);
  const recTimerRef      = useRef(null);
  const recSecondsRef    = useRef(0);

  useEffect(() => { recSecondsRef.current = recSeconds; }, [recSeconds]);

  const handleRecordingStop = useCallback(async (mimeType) => {
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

    try {
      setRecordingError(null);
      setUploadingRecording(true);
      const ext  = blobType.includes("mp4") ? ".mp4" : ".webm";
      const form = new FormData();
      form.append("recording", blob, `recording${ext}`);
      form.append("bookingId", bookingId);
      form.append("duration",  String(recSecondsRef.current));
      const { default: api } = await import("../api");
      await api.post("/recordings/upload", form);
    } catch (err) {
      const serverMsg = err?.response?.data?.message || err?.message || "Unknown error";
      console.error("Recording upload error:", serverMsg, err);
      setRecordingError(`Recording upload failed: ${serverMsg}`);
    } finally {
      setUploadingRecording(false);
    }
  }, [bookingId]);

  const startRecording = useCallback(async () => {
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
    setRecordingError,
    startRecording,
    stopRecording,
    formatRecTime,
  };
}
