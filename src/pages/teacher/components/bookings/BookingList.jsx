import BookingCard from './BookingCard';
import { BookOpen } from 'lucide-react';

const F = "'Nunito','Inter',sans-serif";

export default function BookingList({ bookings, onAccept, onReject, isDarkMode }) {
  const col = {
    card:   isDarkMode ? '#1a1d2e' : '#ffffff',
    border: isDarkMode ? '#2a2d40' : '#e2e8f0',
    muted:  isDarkMode ? '#6b7090' : '#94a3b8',
  };

  if (!bookings || bookings.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', background: col.card, borderRadius: 20, border: `2px solid ${col.border}`, fontFamily: F }}>
        <BookOpen size={36} color={col.muted} style={{ margin: '0 auto 12px' }}/>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: col.muted }}>No booking requests yet</p>
      </div>
    );
  }

  return (
    <div style={{ background: col.card, border: `1.5px solid ${col.border}`, borderRadius: 20, overflow: 'hidden' }}>
      {bookings.map((b, i) => (
        <BookingCard
          key={b._id || b.id}
          booking={b}
          onAccept={onAccept}
          onReject={onReject}
          isDarkMode={isDarkMode}
          isLast={i === bookings.length - 1}
        />
      ))}
    </div>
  );
}
