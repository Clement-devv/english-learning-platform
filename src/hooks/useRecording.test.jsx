import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RECORDING_PART_SECONDS, useRecording } from './useRecording';

const queue = vi.hoisted(() => vi.fn());
vi.mock('../context/UploadQueueContext.jsx', () => ({ useUploadQueue: () => ({ addToQueue: queue, hasActiveUploads: false }) }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); queue.mockReset(); });

it('continues capturing the next part while the previous upload is pending and flushes the final part', async () => {
  vi.useFakeTimers();
  const video = { readyState: 'live', stop: vi.fn() };
  const stream = { getVideoTracks: () => [video], getAudioTracks: () => [], getTracks: () => [video] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getDisplayMedia: vi.fn().mockResolvedValue(stream), getUserMedia: vi.fn().mockRejectedValue(new Error('No mic'))
  } });
  vi.stubGlobal('MediaStream', class {});
  vi.stubGlobal('AudioContext', class {
    createMediaStreamDestination() { return { stream }; }
    close() { return Promise.resolve(); }
  });
  const events = [];
  vi.stubGlobal('MediaRecorder', class extends EventTarget {
    static isTypeSupported(type) { return type === 'video/mp4'; }
    start() { this.state = 'recording'; events.push('start'); }
    stop() {
      this.state = 'inactive'; events.push('stop');
      this.ondataavailable({ data: new Blob(['a'.repeat(2000)]) });
      this.onstop(); this.dispatchEvent(new Event('stop'));
    }
  });
  const { result, unmount } = renderHook(() => useRecording('lesson'));
  try {
    await act(async () => { await Promise.all([result.current.startRecording(), result.current.startRecording()]); });
    act(() => vi.advanceTimersByTime(RECORDING_PART_SECONDS * 1000));
    expect(events).toEqual(['start', 'start', 'stop']);
    expect(result.current.isRecording).toBe(true);
    expect(video.stop).not.toHaveBeenCalled();
    act(() => result.current.stopRecording());
    expect(queue.mock.calls.map(call => [call[3], call[4].partNumber])).toEqual([['.mp4', 1], ['.mp4', 2]]);
    expect(video.stop).toHaveBeenCalledOnce();
  } finally { unmount(); delete navigator.mediaDevices; }
});
