import { studioText } from './studioLanguage';
import { useState } from 'react';
import { BookOpen, Video } from 'lucide-react';
import FamilyVideoPlayer from './FamilyVideoPlayer';

export default function FamilyLessonMaterials({ lesson, request, base, access }) {
  const [open, setOpen] = useState(''), [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const show = async (type, retry = false) => {
    if (!retry && open === type) { setOpen(''); return; }
    setOpen(type); setLoading(true); setError('');
    try { const response = await request('get', `/schedule/${lesson.id}/materials?group=${lesson.group}`); setData(response.data.data); }
    catch { setError('Could not load this lesson. Please try again.'); }
    finally { setLoading(false); }
  };
  return <div className="tm-family-lesson-materials"><div className="tm-family-material-actions">{lesson.hasReview && <button type="button" aria-expanded={open === 'review'} onClick={() => show('review')}><BookOpen size={15} />{open === 'review' ? studioText('Hide class review') : studioText('View class review')}</button>}{lesson.hasRecordings && <button type="button" aria-expanded={open === 'recording'} onClick={() => show('recording')}><Video size={15} />{open === 'recording' ? studioText('Hide recording') : studioText('Watch recording')}</button>}{!lesson.hasReview && !lesson.hasRecordings && <span className="tm-muted">{studioText("Your teacher hasn’t shared a review or recording yet.")}</span>}</div>{open && <div className="tm-family-material-panel">{loading ? <p role="status">{studioText("Loading lesson…")}</p> : error ? <p role="alert">{error} <button type="button" onClick={() => show(open, true)}>Retry</button></p> : open === 'review' ? <><strong>{studioText("Teacher’s class review")}</strong><p className="tm-family-material-review">{data?.review || 'This review is no longer available.'}</p></> : <><strong>{studioText("Class recordings")}</strong>{data?.recordings?.length ? <FamilyVideoPlayer recordings={data.recordings} base={base} access={access} /> : <p>This recording is no longer available.</p>}</>}</div>}</div>;
}
