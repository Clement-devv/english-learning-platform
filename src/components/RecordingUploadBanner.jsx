// src/components/RecordingUploadBanner.jsx
// Floating panel (bottom-right) that shows background recording upload progress.
// Visible on any page — teacher can navigate freely while uploads run.
// Each item shows: progress bar (uploading), success tick (done), retry (failed).

import React, { useState } from 'react';
import { useUploadQueue } from '../context/UploadQueueContext.jsx';
import { Video, CheckCircle2, AlertCircle, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';

function formatBytes(blob) {
  if (!blob?.size) return '';
  const mb = blob.size / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(blob.size / 1024).toFixed(0)} KB`;
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function partLabel(item) {
  if (!item.sessionId) return 'recording';
  const start = item.startOffset || 0;
  return `part ${item.partNumber} (${mmss(start)}–${mmss(start + (item.duration || 0))})`;
}

function UploadItem({ item, onRetry, onDismiss }) {
  const { id, blob, progress, status, errorMsg } = item;
  const size  = formatBytes(blob);
  const label = partLabel(item);

  const isUploading = status === 'uploading';
  const isQueued    = status === 'queued';
  const isRetrying  = status === 'retrying';
  const isDone      = status === 'done';
  const isFailed    = status === 'failed';

  const handleDismiss = () => {
    if (!isDone && !confirm(`This ${label} has not been saved yet. Discard it? It cannot be recovered.`)) return;
    onDismiss(id);
  };

  return (
    <div style={styles.item}>
      {/* Icon */}
      <div style={{
        ...styles.itemIcon,
        background: isDone    ? '#d1fae5'
                  : isFailed  ? '#fee2e2'
                  : '#e0f2fe',
      }}>
        {isDone   && <CheckCircle2 size={16} color="#059669" strokeWidth={2.5} />}
        {isFailed && <AlertCircle  size={16} color="#dc2626" strokeWidth={2.5} />}
        {isRetrying && <RefreshCw  size={16} color="#b45309" strokeWidth={2.5} />}
        {(isUploading || isQueued) && <Video size={16} color="#0284c7" strokeWidth={2} />}
      </div>

      {/* Content */}
      <div style={styles.itemBody}>
        <div style={styles.itemRow}>
          <span style={styles.itemLabel}>
            {isDone       ? `Saved ${label}`
             : isFailed   ? `Could not save ${label}`
             : isRetrying ? `Retrying ${label}…`
             : isQueued   ? `Waiting to upload ${label}`
             : `Uploading ${label}`}
          </span>
          <span style={styles.itemSize}>{size}</span>
        </div>

        {isUploading && (
          <>
            <div style={styles.trackOuter}>
              <div style={{ ...styles.trackFill, width: `${progress}%` }} />
            </div>
            <span style={styles.pct}>{progress}%</span>
          </>
        )}

        {isRetrying && (
          <span style={styles.retryingMsg}>
            {errorMsg ? `${errorMsg} — ` : ''}trying again automatically (attempt {item.attempts + 1})
          </span>
        )}

        {isFailed && (
          <div style={styles.errorRow}>
            <span style={styles.errorMsg}>{errorMsg}</span>
            <button style={styles.retryBtn} onClick={() => onRetry(id)}>
              <RefreshCw size={11} strokeWidth={2.5} />
              Retry
            </button>
          </div>
        )}

        {isDone && (
          <span style={styles.doneMsg}>Saved successfully ✓</span>
        )}
      </div>

      {/* Dismiss button (not while the part is actively uploading) */}
      {!isUploading && (
        <button style={styles.dismissBtn} onClick={handleDismiss} aria-label="Dismiss">
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

export default function RecordingUploadBanner() {
  const { queue, retryUpload, retryAll, dismissItem } = useUploadQueue();
  const [collapsed, setCollapsed] = useState(false);

  if (!queue.length) return null;

  const uploadingCount = queue.filter(q => ['queued', 'uploading', 'retrying'].includes(q.status)).length;
  const failedCount    = queue.filter(q => q.status === 'failed').length;

  const headerLabel =
    uploadingCount > 0 ? `Saving ${uploadingCount} recording part${uploadingCount > 1 ? 's' : ''}…`
    : failedCount  > 0 ? `${failedCount} part${failedCount > 1 ? 's' : ''} not saved`
    : 'Recordings saved';

  const headerColor =
    uploadingCount > 0 ? '#0369a1'
    : failedCount  > 0 ? '#dc2626'
    : '#059669';

  return (
    <>
      <style>{css}</style>
      <div style={styles.wrap}>

        {/* Header */}
        <button style={{ ...styles.header, borderColor: headerColor + '33' }} onClick={() => setCollapsed(c => !c)}>
          <div style={{
            ...styles.headerDot,
            background: headerColor,
            animation: uploadingCount > 0 ? 'rub-pulse 1.4s ease-in-out infinite' : 'none',
          }} />
          <span style={{ ...styles.headerLabel, color: headerColor }}>{headerLabel}</span>
          {collapsed
            ? <ChevronUp   size={14} color={headerColor} strokeWidth={2.5} />
            : <ChevronDown size={14} color={headerColor} strokeWidth={2.5} />
          }
        </button>

        {/* Items */}
        {!collapsed && (
          <div style={styles.list}>
            {queue.map(item => (
              <UploadItem
                key={item.id}
                item={item}
                onRetry={retryUpload}
                onDismiss={dismissItem}
              />
            ))}
          </div>
        )}

        {/* Retry every failed part at once */}
        {!collapsed && failedCount > 1 && (
          <button style={styles.retryAllBtn} onClick={retryAll}>
            <RefreshCw size={12} strokeWidth={2.5} />
            Retry all {failedCount} parts
          </button>
        )}

        {/* Keep-open hint */}
        {!collapsed && (uploadingCount > 0 || failedCount > 0) && (
          <div style={styles.warning}>
            {uploadingCount > 0
              ? "⚠️ Keep this tab open while saving. If it closes, unsaved parts can be retried when you come back."
              : "Unsaved parts are kept on this computer until you retry or discard them."}
          </div>
        )}
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  wrap: {
    position:     'fixed',
    bottom:       24,
    right:        24,
    zIndex:       9980,
    width:        320,
    background:   '#ffffff',
    borderRadius: 16,
    boxShadow:    '0 8px 40px rgba(0,0,0,0.18)',
    border:       '1px solid #e2e8f0',
    overflow:     'hidden',
    fontFamily:   "'Inter', system-ui, sans-serif",
  },
  header: {
    display:         'flex',
    alignItems:      'center',
    gap:             8,
    width:           '100%',
    padding:         '12px 14px',
    background:      '#f8fafc',
    border:          'none',
    borderBottom:    '1px solid',
    cursor:          'pointer',
    textAlign:       'left',
  },
  headerDot: {
    width:        8,
    height:       8,
    borderRadius: '50%',
    flexShrink:   0,
  },
  headerLabel: {
    flex:       1,
    fontSize:   13,
    fontWeight: 700,
  },
  list: {
    display:       'flex',
    flexDirection: 'column',
    gap:           0,
    maxHeight:     320,
    overflowY:     'auto',
  },
  item: {
    display:       'flex',
    alignItems:    'flex-start',
    gap:           10,
    padding:       '11px 14px',
    borderBottom:  '1px solid #f1f5f9',
  },
  itemIcon: {
    width:          34,
    height:         34,
    borderRadius:   9,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  itemBody: {
    flex:          1,
    minWidth:      0,
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
  },
  itemRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    gap:            6,
  },
  itemLabel: {
    fontSize:   12.5,
    fontWeight: 700,
    color:      '#0f172a',
  },
  itemSize: {
    fontSize:  11,
    color:     '#94a3b8',
    flexShrink: 0,
  },
  trackOuter: {
    height:       5,
    background:   '#e0f2fe',
    borderRadius: 99,
    overflow:     'hidden',
  },
  trackFill: {
    height:     '100%',
    background: 'linear-gradient(90deg, #0369a1, #0ea5e9)',
    borderRadius: 99,
    transition: 'width 0.3s ease',
  },
  pct: {
    fontSize:   11,
    color:      '#0284c7',
    fontWeight: 700,
  },
  errorRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         8,
    flexWrap:    'wrap',
  },
  errorMsg: {
    fontSize: 11,
    color:    '#dc2626',
    flex:     1,
  },
  retryBtn: {
    display:        'flex',
    alignItems:     'center',
    gap:            4,
    padding:        '3px 9px',
    borderRadius:   6,
    border:         '1px solid #fca5a5',
    background:     '#fef2f2',
    color:          '#dc2626',
    fontSize:       11,
    fontWeight:     700,
    cursor:         'pointer',
    fontFamily:     'inherit',
    flexShrink:     0,
  },
  doneMsg: {
    fontSize:   11,
    color:      '#059669',
    fontWeight: 600,
  },
  retryingMsg: {
    fontSize: 11,
    color:    '#b45309',
  },
  retryAllBtn: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    width:          '100%',
    padding:        '9px 14px',
    border:         'none',
    borderTop:      '1px solid #fecaca',
    background:     '#fef2f2',
    color:          '#dc2626',
    fontSize:       12,
    fontWeight:     700,
    cursor:         'pointer',
    fontFamily:     'inherit',
  },
  dismissBtn: {
    background:     'none',
    border:         'none',
    cursor:         'pointer',
    color:          '#94a3b8',
    padding:        2,
    display:        'flex',
    alignItems:     'center',
    flexShrink:     0,
    marginTop:      2,
    borderRadius:   4,
  },
  warning: {
    padding:    '8px 14px',
    background: '#fefce8',
    borderTop:  '1px solid #fef08a',
    fontSize:   11,
    color:      '#854d0e',
    fontWeight: 600,
  },
};

const css = `
@keyframes rub-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
`;
