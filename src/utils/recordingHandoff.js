// Live capture stays in memory only; it is never stored or shared between tabs.
let pending = null;
export function discardRecordingHandoff() {
  if (!pending) return;
  clearTimeout(pending.timer);
  const { capture } = pending;
  capture.tabStream?.getTracks().forEach(track => track.stop());
  capture.micStream?.getTracks().forEach(track => track.stop());
  capture.audioContext?.close().catch(() => {});
  pending = null;
}
export function offerRecordingHandoff(bookingId, capture) {
  discardRecordingHandoff();
  pending = { bookingId, capture, timer: setTimeout(discardRecordingHandoff, 120000) };
}
export function takeRecordingHandoff(bookingId) {
  if (!pending || pending.bookingId !== bookingId) return null;
  const capture = pending.capture;
  clearTimeout(pending.timer); pending = null;
  return capture;
}
