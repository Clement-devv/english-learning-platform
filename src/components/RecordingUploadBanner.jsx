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

function UploadItem({ item, onRetry, onDismiss }) {
  const { id, blob, progress, status, errorMsg } = item;
  const size = formatBytes(blob);

  const isUploading = status === 'uploading';
  const isDone      = status === 'done';
  const isFailed    = status === 'failed';

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
        {isUploading && <Video     size={16} color="#0284c7" strokeWidth={2} />}
      </div>

      {/* Content */}
      <div style={styles.itemBody}>
        <div style={styles.itemRow}>
          <span style={styles.itemLabel}>
            {isDone      ? 'Recording saved'
             : isFailed  ? 'Upload failed'
             : 'Uploading recording'}
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

      {/* Dismiss button (only on done/failed) */}
      {!isUploading && (
        <button style={styles.dismissBtn} onClick={() => onDismiss(id)} aria-label="Dismiss">
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

export default function RecordingUploadBanner() {
  const { queue, retryUpload, dismissItem } = useUploadQueue();
  const [collapsed, setCollapsed] = useState(false);

  if (!queue.length) return null;

  const uploadingCount = queue.filter(q => q.status === 'uploading').length;
  const failedCount    = queue.filter(q => q.status === 'failed').length;

  const headerLabel =
    uploadingCount > 0 ? `Uploading ${uploadingCount} recording${uploadingCount > 1 ? 's' : ''}…`
    : failedCount  > 0 ? `${failedCount} upload${failedCount > 1 ? 's' : ''} failed`
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

        {/* Do-not-close warning */}
        {!collapsed && uploadingCount > 0 && (
          <div style={styles.warning}>
            ⚠️ Don't close this tab — uploads will be lost.
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
