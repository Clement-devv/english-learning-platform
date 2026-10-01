// src/context/UploadQueueContext.jsx
// Global background-upload queue for class recordings.
//
// Why global: the upload must outlive the Classroom component. When a teacher
// ends a class and navigates to the dashboard, the Classroom unmounts. Keeping
// the upload here (in App-level context) means it keeps running no matter what
// page the teacher visits next.
//
// Flow:
//   Recorder cuts a part every few minutes → addToQueue(blob, ...) → returns instantly
//   Part is stored in IndexedDB first, then uploaded (one part at a time, in order)
//   On failure → retried automatically a few times, then status:'failed' with Retry
//   On success → removed from IndexedDB, card auto-dismissed after 6 s
//   On tab close / crash → unsaved parts are restored on next load with a Retry button

import React, {
  createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react';
import api from '../api.js';
import { savePart, deletePart, loadParts } from '../utils/recordingStore.js';

const UploadQueueContext = createContext(null);

// Wait before each automatic retry; after the last one the teacher retries manually
const AUTO_RETRY_DELAYS = [5000, 15000, 30000];

// Fields persisted to IndexedDB (everything needed to re-run the upload)
const persistable = ({ id, blob, bookingId, duration, ext, sessionId, partNumber, startOffset, startedAt }) =>
  ({ id, blob, bookingId, duration, ext, sessionId, partNumber, startOffset, startedAt });

export function UploadQueueProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const queueRef   = useRef([]);
  const busyRef    = useRef(false);          // an upload is in flight
  const timersRef  = useRef(new Map());      // id → auto-retry timeout
  const pumpRef    = useRef(() => {});

  // queueRef is the source of truth (updated synchronously) so pump() and
  // timers always see the latest queue; React state mirrors it for rendering.
  const setQueueSync = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(queueRef.current) : updater;
    queueRef.current = next;
    setQueue(next);
  }, []);

  const updateItem = useCallback((id, updates) => {
    setQueueSync(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, [setQueueSync]);

  const doUpload = useCallback(async (item) => {
    const { id, blob, bookingId, duration, ext, sessionId, partNumber, startOffset } = item;
    const form = new FormData();
    form.append('recording', blob, `recording${ext}`);
    form.append('bookingId', bookingId);
    form.append('duration',  String(duration));
    if (sessionId) {
      form.append('sessionId',   sessionId);
      form.append('partNumber',  String(partNumber));
      form.append('startOffset', String(startOffset || 0));
    }

    try {
      await api.post('/recordings/upload', form, {
        timeout: 0, // disable axios timeout — large files need as long as they need
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          updateItem(id, { progress: pct });
        },
      });

      deletePart(id);
      updateItem(id, { status: 'done', progress: 100, blob: null });

      // Auto-dismiss the success card after 6 s
      setTimeout(() => {
        setQueueSync(prev => prev.filter(q => q.id !== id));
      }, 6000);

    } catch (err) {
      const httpStatus = err?.response?.status;
      const errorMsg =
        err?.response?.data?.message ||
        (err?.code === 'ECONNABORTED' ? 'Connection timed out' : null) ||
        err?.message ||
        'Upload failed';

      // 4xx (other than timeout / rate limit) won't succeed on retry — stop and ask
      const retryable = !httpStatus || httpStatus >= 500 || httpStatus === 408 || httpStatus === 429;
      const attempts  = (item.attempts || 0) + 1;

      if (retryable && attempts <= AUTO_RETRY_DELAYS.length) {
        const delay = AUTO_RETRY_DELAYS[attempts - 1];
        updateItem(id, { status: 'retrying', attempts, errorMsg, progress: 0 });
        const t = setTimeout(() => {
          timersRef.current.delete(id);
          const current = queueRef.current.find(q => q.id === id);
          if (current?.status === 'retrying') {
            updateItem(id, { status: 'queued' });
            pumpRef.current();
          }
        }, delay);
        timersRef.current.set(id, t);
      } else {
        updateItem(id, { status: 'failed', attempts, errorMsg });
      }
    } finally {
      busyRef.current = false;
      pumpRef.current();
    }
  }, [updateItem, setQueueSync]);

  // Start the next queued part — one upload at a time so parts arrive in order
  // and a slow connection isn't split between several large files.
  const pump = useCallback(() => {
    if (busyRef.current) return;
    const next = queueRef.current.find(q => q.status === 'queued' && q.blob);
    if (!next) return;
    busyRef.current = true;
    updateItem(next.id, { status: 'uploading', progress: 0, errorMsg: null });
    doUpload(next);
  }, [doUpload, updateItem]);

  useEffect(() => { pumpRef.current = pump; }, [pump]);

  // ── Restore parts left over from a closed/crashed tab ──────────────────────
  useEffect(() => {
    let cancelled = false;
    loadParts().then(parts => {
      if (cancelled || parts.length === 0) return;
      setQueueSync(prev => {
        const known = new Set(prev.map(q => q.id));
        const restored = parts
          .filter(p => p.blob && !known.has(p.id))
          .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
          .map(p => ({
            ...p,
            progress: 0,
            status:   'failed',
            attempts: 0,
            restored: true,
            errorMsg: 'Not saved yet — the page closed before this part finished uploading.',
          }));
        return [...prev, ...restored];
      });
    });
    return () => { cancelled = true; };
  }, [setQueueSync]);

  useEffect(() => () => {
    timersRef.current.forEach(t => clearTimeout(t));
  }, []);

  /**
   * Add a recording (or one part of a split recording) to the upload queue.
   * Returns the queue item ID immediately; the upload runs in the background.
   */
  const addToQueue = useCallback((blob, bookingId, duration, ext, part = {}) => {
    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item = {
      id, blob, bookingId, duration, ext,
      sessionId:   part.sessionId   || null,
      partNumber:  part.partNumber  || 1,
      startOffset: part.startOffset || 0,
      progress: 0, status: 'queued', errorMsg: null, attempts: 0,
      startedAt: Date.now(),
    };
    setQueueSync(prev => [...prev, item]);
    // Store locally first so a crash mid-upload can't lose the part
    savePart(persistable(item)).finally(() => pumpRef.current());
    return id;
  }, [setQueueSync]);

  /** Re-run a failed upload. No-op if the blob is gone. */
  const retryUpload = useCallback((id) => {
    const item = queueRef.current.find(q => q.id === id);
    if (!item?.blob) return;
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
    updateItem(id, { status: 'queued', progress: 0, errorMsg: null, attempts: 0, restored: false });
    pumpRef.current();
  }, [updateItem]);

  /** Retry every failed part (in recording order). */
  const retryAll = useCallback(() => {
    queueRef.current
      .filter(q => q.status === 'failed' && q.blob)
      .forEach(q => retryUpload(q.id));
  }, [retryUpload]);

  /**
   * Remove an item from the list. For a part that was never saved this also
   * deletes the local copy — the caller confirms with the teacher first.
   */
  const dismissItem = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
    const item = queueRef.current.find(q => q.id === id);
    if (item && item.status !== 'done') deletePart(id);
    setQueueSync(prev => prev.filter(q => q.id !== id));
  }, [setQueueSync]);

  // ── Warn before tab close if any upload is running ──────────────────────────
  const hasActiveUploads = queue.some(q => ['queued', 'uploading', 'retrying'].includes(q.status));

  useEffect(() => {
    if (!hasActiveUploads) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = 'A recording is still uploading. You can retry it next time you open the app.';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasActiveUploads]);

  return (
    <UploadQueueContext.Provider value={{ queue, addToQueue, retryUpload, retryAll, dismissItem, hasActiveUploads }}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) return {
    queue: [], hasActiveUploads: false,
    addToQueue: () => {}, retryUpload: () => {}, retryAll: () => {}, dismissItem: () => {},
  };
  return ctx;
}
