import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StandaloneTeachersTab from './StandaloneTeachersTab';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('standalone teacher management', () => {
  it('filters teachers and opens a read-only workspace in a new tab', async () => {
    const teachers = [{ _id: 'one', name: 'Amara', email: 'amara@example.com', status: 'active', ownerId: 'owner' }, { _id: 'two', name: 'Minh', email: 'minh@example.com', status: 'invited' }];
    const fetchMock = vi.fn(async url => ({ ok: true, json: async () => ({ data: url.endsWith('/view') ? { token: 'view-token', teacher: { id: 'owner', firstName: 'Amara' } } : teachers }) }));
    vi.stubGlobal('fetch', fetchMock);
    const tab = { location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab);
    render(<StandaloneTeachersTab apiBase="/api" authHeaders={{ Authorization: 'Bearer admin' }} />);
    expect(await screen.findByText('Amara')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search teachers'), { target: { value: 'Amara' } });
    expect(screen.queryByText('Minh')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View workspace' }));
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith(expect.stringContaining('#teacher_view_token=view-token')));
    expect(fetchMock).toHaveBeenCalledWith('/api/teacher-mode/admin/workspaces/one/view', expect.objectContaining({ method: 'POST' }));
  });
});
