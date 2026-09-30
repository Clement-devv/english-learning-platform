// src/context/UploadQueueContext.jsx
// Global background-upload queue for class recordings.
//
// Why global: the upload must outlive the Classroom component. When a teacher
// ends a class and navigates to the dashboard, the Classroom unmounts. Keeping
// the upload here (in App-level context) means it keeps running no matter what
// page the teacher visits next.
//
// Flow:
//   Classroom records → stopRecording() → addToQueue(blob, ...) → returns instantly
//   Queue uploads in background with progress → banner shows % on dashboard
//   On failure → item stays in queue with status:'failed' → Retry button re-runs upload
//   On success → item auto-dismissed after 6 s
//   On tab close while uploading → browser shows native "Leave site?" warning

import React, {
  createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react';
import api from '../api.js';

const UploadQueueContext = createContext(null);

export function UploadQueueProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const queueRef = useRef([]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const updateItem = useCallback((id, updates) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const doUpload = useCallback(async (id, blob, bookingId, duration, ext) => {
    const form = new FormData();
    form.append('recording', blob, `recording${ext}`);
    form.append('bookingId', bookingId);
    form.append('duration',  String(duration));

    try {
      await api.post('/recordings/upload', form, {
        timeout: 0, // disable axios timeout — large files need as long as they need
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          updateItem(id, { progress: pct });
        },
      });

      updateItem(id, { status: 'done', progress: 100 });

      // Auto-dismiss the success card after 6 s
      setTimeout(() => {
        setQueue(prev => prev.filter(q => q.id !== id));
      }, 6000);

    } catch (err) {
      const errorMsg =
        err?.response?.data?.message ||
        (err?.code === 'ECONNABORTED' ? 'Connection timed out' : null) ||
        err?.message ||
        'Upload failed';
      updateItem(id, { status: 'failed', errorMsg });
    }
  }, [updateItem]);

  /**
   * Add a recording blob to the upload queue and start uploading immediately.
   * Returns the queue item ID.
   */
  const addToQueue = useCallback((blob, bookingId, duration, ext) => {
    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setQueue(prev => [...prev, {
      id, blob, bookingId, duration, ext,
      progress: 0, status: 'uploading', errorMsg: null,
      startedAt: Date.now(),
    }]);
    doUpload(id, blob, bookingId, duration, ext);
    return id;
  }, [doUpload]);

  /** Re-run a failed upload. No-op if blob is gone (page was refreshed). */
  const retryUpload = useCallback((id) => {
    const item = queueRef.current.find(q => q.id === id);
    if (!item?.blob) return;
    updateItem(id, { status: 'uploading', progress: 0, errorMsg: null });
    doUpload(id, item.blob, item.bookingId, item.duration, item.ext);
  }, [doUpload, updateItem]);

  /** Manually dismiss any item (used for done/failed cards). */
  const dismissItem = useCallback((id) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  }, []);

  // ── Warn before tab close if any upload is running ──────────────────────────
  const hasActiveUploads = queue.some(q => q.status === 'uploading');

  useEffect(() => {
    if (!hasActiveUploads) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = 'A recording is still uploading. Leaving will lose it.';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasActiveUploads]);

  return (
    <UploadQueueContext.Provider value={{ queue, addToQueue, retryUpload, dismissItem, hasActiveUploads }}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) return {
    queue: [], hasActiveUploads: false,
    addToQueue: () => {}, retryUpload: () => {}, dismissItem: () => {},
  };
  return ctx;
}
