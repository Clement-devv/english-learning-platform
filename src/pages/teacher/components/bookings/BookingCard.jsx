import { getUserTimezone, dualTime, tzCity } from '../../../../utils/timezone';
import ManagedBadge from '../../../../components/ManagedBadge';

const F = "'Nunito','Inter',sans-serif";

export default function BookingCard({ booking, onAccept, onReject, isDarkMode, isLast }) {
  const myTZ = getUserTimezone();
  const dual = booking.scheduledTime ? dualTime(booking.scheduledTime, myTZ, booking.studentTimezone) : null;
  const showStudentTZ = dual && !dual.sameZone && booking.studentTimezone;

  const col = {
    border:  isDarkMode ? 'var(--as-line, #2a2d40)' : 'var(--as-line, #e2e8f0)',
    heading: isDarkMode ? 'var(--as-ink, #f0f4ff)' : 'var(--as-ink, #1e293b)',
    body:    isDarkMode ? 'var(--as-ink-2, #c8cce0)' : 'var(--as-ink-2, #475569)',
    muted:   isDarkMode ? 'var(--as-ink-2, #6b7090)' : 'var(--as-muted, #94a3b8)',
    hover:   isDarkMode ? 'rgba(255,255,255,0.03)' : 'var(--as-raised, #f8faff)',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
      gap: 12, padding: '16px 20px', fontFamily: F,
      borderBottom: isLast ? 'none' : `1.5px solid ${col.border}`,
    }}>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: col.heading }}>
            {booking.name || booking.studentName}
          </h4>
          {booking.isManaged && <ManagedBadge isDarkMode={isDarkMode} />}
          {booking.isAdminBooking && (
            <span style={{ fontSize: 11, fontWeight: 700, background: isDarkMode ? 'color-mix(in srgb, var(--as-accent, #8b5cf6) 15%, transparent)' : 'var(--as-accent-soft, #f3e8ff)', color: 'var(--as-accent-ink, #7c3aed)', borderRadius: 999, padding: '2px 8px' }}>
              Admin Request
            </span>
          )}
        </div>

        <p style={{ margin: '2px 0', fontSize: 13, color: col.body, fontWeight: 600 }}>
          {booking.classTitle}
        </p>

        {booking.topic && (
          <p style={{ margin: '2px 0', fontSize: 12, color: col.muted }}>
            Topic: {booking.topic}
          </p>
        )}

        {/* Teacher's local time */}
        <p style={{ margin: '2px 0', fontSize: 12, color: col.muted }}>
          Your time:{' '}
          <span style={{ fontWeight: 700, color: col.body }}>
            {dual ? `${dual.myTime} ${dual.myAbbr}` : booking.time}
          </span>
        </p>

        {/* Student's time if different timezone */}
        {showStudentTZ && (
          <p style={{ margin: '2px 0', fontSize: 12, color: isDarkMode ? '#60a5fa' : '#3b82f6', fontWeight: 600 }}>
            Student ({tzCity(booking.studentTimezone)}): {dual.theirTime} {dual.theirAbbr}
          </p>
        )}

        {booking.duration && (
          <p style={{ margin: '2px 0', fontSize: 12, color: col.muted }}>
            Duration: <span style={{ fontWeight: 700, color: col.body }}>{booking.duration} min</span>
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => onAccept(booking)}
          style={{
            background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff',
            border: 'none', borderRadius: 10, padding: '8px 16px',
            fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: F,
          }}>
          Accept
        </button>
        <button
          onClick={() => onReject(booking)}
          style={{
            background: isDarkMode ? 'rgba(239,68,68,0.15)' : '#fef2f2',
            color: '#ef4444', border: `1.5px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`,
            borderRadius: 10, padding: '8px 16px',
            fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: F,
          }}>
          Reject
        </button>
      </div>
    </div>
  );
}
