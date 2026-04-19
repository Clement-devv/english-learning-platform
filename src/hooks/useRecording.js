import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Handles tab recording (MediaRecorder API) and upload to /recordings/upload.
 * @param {string|null} bookingId - Booking the recording belongs to.
 * @returns {{ isRecording: boolean, uploadingRecording: boolean, recSeconds: number,
 *   startRecording: () => Promise<void>, stopRecording: () => void,
 *   formatRecTime: (seconds: number) => string }}
 */
export function useRecording(bookingId) {
  const [isRecording,        setIsRecording]        = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const [recSeconds,         setRecSeconds]         = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const tabStreamRef     = useRef(null);
  const recTimerRef      = useRef(null);
  // recSeconds must be accessible inside the async onstop callback
  const recSecondsRef    = useRef(0);

  useEffect(() => { recSecondsRef.current = recSeconds; }, [recSeconds]);

  const handleRecordingStop = useCallback(async (mimeType) => {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (!bookingId || blob.size < 1000) return;

    try {
      setUploadingRecording(true);
      const ext  = mimeType.includes("mp4") ? ".mp4" : ".webm";
      const form = new FormData();
      form.append("recording", blob, `recording${ext}`);
      form.append("bookingId", bookingId);
      form.append("duration",  String(recSecondsRef.current));
      const { default: api } = await import("../api");
      await api.post("/recordings/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (err) {
      console.error("Recording upload error:", err);
    } finally {
      setUploadingRecording(false);
    }
  }, [bookingId]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: true,
        preferCurrentTab: true,
      });
      tabStreamRef.current = stream;
      chunksRef.current    = [];

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => handleRecordingStop(mimeType);

      // If teacher stops screen share manually, treat as recording stop
      stream.getVideoTracks()[0].onended = () => {
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
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    tabStreamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(recTimerRef.current);
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      tabStreamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(recTimerRef.current);
    };
  }, []);

  const formatRecTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return {
    isRecording,
    uploadingRecording,
    recSeconds,
    startRecording,
    stopRecording,
    formatRecTime,
  };
}
