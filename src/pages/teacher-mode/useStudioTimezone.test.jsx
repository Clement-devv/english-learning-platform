import { act, renderHook } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import api from '../../api';
import { useStudioTimezone } from './useStudioTimezone';
vi.mock('../../api', () => ({ default: { patch: vi.fn(async () => ({ data: { ok: true } })) } }));
vi.mock('../../utils/timezone', () => ({ getUserTimezone: () => 'Africa/Lagos' }));
it('saves the device timezone for standalone reports and updates the cached profile', async () => {
  const setUser = vi.fn(), onError = vi.fn();
  const hook = renderHook(() => useStudioTimezone({ _id: 'teacher', timezone: '' }, setUser, onError));
  await act(async () => {});
  expect(api.patch).toHaveBeenCalledWith('/teachers/teacher/timezone', { timezone: 'Africa/Lagos' });
  expect(setUser).toHaveBeenCalledWith({ timezone: 'Africa/Lagos' });
  expect(onError).not.toHaveBeenCalled();
  hook.unmount();
});
