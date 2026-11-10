import { useState } from 'react';

export default function FamilyLessonReview({ work, request, run, busy }) {
  const [rating, setRating] = useState(work.review?.rating || 5), [comment, setComment] = useState(work.review?.comment || '');
  return <details><summary>{work.review ? 'Update your lesson review' : 'Review this lesson'}</summary><form onSubmit={e => { e.preventDefault(); run(() => request('post', `/work/${work._id}/review`, { rating: Number(rating), comment })); }}><label>Lesson rating<select value={rating} onChange={e => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} {n === 1 ? 'star' : 'stars'}</option>)}</select></label><label>Feedback for the teacher<textarea maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} /></label><button disabled={busy}>Save lesson review</button></form></details>;
}
