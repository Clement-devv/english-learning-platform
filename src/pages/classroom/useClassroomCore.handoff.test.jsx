import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import api from '../../api';
import { ClassHandoffContext } from './ClassHandoffContext';
import { useClassroomCore } from './useClassroomCore';
vi.mock('../../api', () => ({ default: { get: vi.fn(async () => ({ data: { session: null } })), post: vi.fn() } }));
it('ends attendance before settling and waits for the server outcome', async () => {
  let settle;
  api.post.mockImplementation(async (url) => url === '/classroom/auto-complete'
    ? new Promise(resolve => { settle = resolve; }) : { data: { session: null } });
  const handoff = { finishClass: { current: null } };
  const wrapper = ({ children }) => <ClassHandoffContext.Provider value={handoff}>{children}</ClassHandoffContext.Provider>;
  const hook = renderHook(() => useClassroomCore({ bookingId: 'lesson', userRole: 'teacher', duration: 30 }), { wrapper });
  try {
    await act(async () => {});
    let finish, done = false;
    await act(async () => { finish = handoff.finishClass.current().then(result => { done = true; return result; }); });
    expect(api.post).toHaveBeenCalledWith('/classroom/attendance', expect.objectContaining({ bookingId: 'lesson', action: 'leave', activeTime: 0 }));
    expect(api.post).toHaveBeenCalledWith('/classroom/auto-complete', { bookingId: 'lesson', clientBothActiveTime: 0, callerRole: 'teacher' });
    expect(done).toBe(false);
    await act(async () => { settle({ data: { completed: false, missed: true } }); expect(await finish).toEqual({ completed: false, missed: true }); });
    expect(done).toBe(true);
  } finally { hook.unmount(); }
});
