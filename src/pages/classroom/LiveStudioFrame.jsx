import { useClassConfirmation } from '../teacher-mode/ClassConfirmation';
import '../teacher-mode/teacherMode.css';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { studioClassroomState } from '../../utils/teacherMode';
import { nextStudioClass } from '../../utils/nextStudioClass';
import { discardRecordingHandoff } from '../../utils/recordingHandoff';
import { ClassHandoffContext } from './ClassHandoffContext';
import NextClassButton from './NextClassButton';
import React, { createContext, useContext, lazy, Suspense, useState, useRef, useMemo, useEffect } from 'react';
export const LiveStudioNavigation = createContext(null);
const StudioDashboard = lazy(() => import('../teacher-mode/TeacherModeDashboard'));

export default function LiveStudioFrame({ enabled, bookingId, provider, children }) {
  const [dashboard, setDashboard] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const open = () => setDashboard(true);
    window.addEventListener('studio-open-dashboard', open);
    return () => window.removeEventListener('studio-open-dashboard', open);
  }, [enabled]);
  const navigate = useNavigate();
  const { ask, dialog } = useClassConfirmation();
  const finishClass = useRef(null);
  const recorder = useRef(null), locked = useRef(false);
  const [next, setNext] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [keepCapture, setKeepCapture] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api.get('/work').then(({ data }) => { if (!cancelled) setNext(nextStudioClass(data.data || [], bookingId)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, bookingId]);
  const goNext = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const { data } = await api.get('/work');
      const work = data.data || [];
      const current = work.find(lesson => String(lesson._id) === String(bookingId));
      if (!current) throw new Error('Could not find the current class. Please retry.');
      const needsEnding = !['completed', 'missed'].includes(current.status);
      if (needsEnding && !['accepted', 'open', 'full', 'in-progress'].includes(current.status)) throw new Error('This class cannot be ended from the classroom. Please review its status in Classes & updates.');
      const target = nextStudioClass(work, bookingId);
      setNext(target);
      if (!target) throw new Error('No next booked class is available.');
      if (Date.parse(target.scheduledTime) - Date.now() > 30 * 60000) throw new Error('The next class opens 30 minutes before its scheduled start.');
      if (target.isGroupClass && (target.platform || 'agora') !== 'agora') throw new Error('This group class uses an external meeting. Open it from Classes & updates; shared-tab handover is not available for this class yet.');
      if (keepCapture && !recorder.current) throw new Error('No active shared tab is available. Uncheck Keep shared tab and start recording in the next class.');
      if (keepCapture && target.isGroupClass && provider !== 'agora') throw new Error('The next class uses in-app video. Uncheck Keep shared tab and select this classroom tab when recording the next class.');
      if (needsEnding) {
        if (!finishClass.current) throw new Error('This classroom is still connecting or needs its own end-class controls. Please try again once it is ready.');
        const confirmed = await ask({
          title: 'End this class and switch?',
          message: 'End ' + (current.classTitle || current.title || 'this class') + ' and open ' + (target.classTitle || target.title || 'the next class') + '? Your recording will be saved separately. Attendance determines whether this class is completed or not completed; ending early may mean it is not completed.',
          action: 'Yes, end class and switch',
        });
        if (!confirmed) return;
      }
      // Persist the old class recording before releasing its recorder or changing booking IDs.
      await recorder.current?.prepareHandoff(target.isGroupClass ? 'group:' + target._id : target._id, keepCapture);
      if (needsEnding) await finishClass.current();
      if (target.isGroupClass) {
        if (target.status !== 'in-progress') await api.patch('/group-classes/' + target._id + '/start');
        await api.get('/group-classes/' + target._id + '/join');
      }
      let teacher = {};
      try { teacher = JSON.parse(sessionStorage.getItem('teacherInfo') || '{}'); } catch (_) {}
      navigate('/classroom', { state: { ...studioClassroomState(target, teacher), handoffProvider: target.isGroupClass ? undefined : provider } });
    } catch (err) {
      discardRecordingHandoff();
      setError(err.response?.data?.message || err.message || 'Could not switch classes. Please retry.');
    } finally { locked.current = false; setBusy(false); }
  };
  const handoff = useMemo(() => ({ recorder, finishClass, next, busy, error, keepCapture, setKeepCapture, goNext }), [next, busy, error, keepCapture, bookingId, provider]);
  if (!enabled) return children;
  return <ClassHandoffContext.Provider value={handoff}><LiveStudioNavigation.Provider value={() => setDashboard(true)}>
    <div className="tm" style={{ display: "contents" }}>{dialog}</div>
    <div hidden={dashboard}>
      {children}
    </div>
    {dashboard && <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-green-100 text-green-900" role="status">
        <span>Class in progress · Keep this window open.</span>
        <button type="button" className="rounded-lg border px-4 py-2 font-semibold" onClick={() => setDashboard(false)}>Return to class</button>
      </div>
      <Suspense fallback={<p role="status">Loading dashboard…</p>}>
        <StudioDashboard liveBookingId={bookingId} onReturnToClass={() => setDashboard(false)} />
      </Suspense>
    </>}
  </LiveStudioNavigation.Provider></ClassHandoffContext.Provider>;
}


export function StudioDashboardButton() {
  const openDashboard = useContext(LiveStudioNavigation);
  if (!openDashboard) return null;
  return <><button type="button" onClick={openDashboard}
    title="Back to dashboard — class and recording stay running"
    className="shrink-0 rounded-lg border border-stone-300 bg-stone-100 px-2.5 py-2 text-xs font-semibold text-stone-800 hover:bg-white focus-visible:outline focus-visible:outline-2">
    Back to dashboard
  </button><NextClassButton /></>;
}
