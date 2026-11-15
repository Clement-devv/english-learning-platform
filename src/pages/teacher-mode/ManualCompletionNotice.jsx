import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './manualCompletionNotice.css';

export default function ManualCompletionNotice({ lessons = [] }) {
  const { i18n } = useTranslation();
  const [, tick] = useState(0);
  const now = Date.now();
  const expiry = lesson => Date.parse(lesson.completedAt) + 48 * 60 * 60 * 1000;
  const active = lessons.filter(lesson => expiry(lesson) > now);
  const next = Math.min(...active.map(expiry));
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => tick(n => n + 1), Math.max(0, next - Date.now()));
    return () => clearTimeout(timer);
  }, [next]);
  if (!active.length) return null;
  const vi = i18n.language?.startsWith('vi');
  const date = value => new Date(value).toLocaleDateString(vi ? 'vi-VN' : 'en', { dateStyle: 'medium' });
  const messages = active.map(lesson => {
    const title = lesson.classTitle || lesson.title;
    return vi
    ? `Ngày ${date(lesson.completedAt)}, giáo viên đã đánh dấu buổi học “${title}” ngày ${date(lesson.scheduledTime)} là đã dạy.`
    : `On ${date(lesson.completedAt)}, the teacher manually marked “${title}” (scheduled for ${date(lesson.scheduledTime)}) as taught.`;
  });
  return <div className="tm-manual-notice" tabIndex={0}>
    <div className="tm-notice-track" style={{ animationDuration: (messages.join('').length / 12 + 3) + 's' }}>
      {messages.map((message, i) => <span key={active[i]._id}>{message}</span>)}
    </div>
  </div>;
}
