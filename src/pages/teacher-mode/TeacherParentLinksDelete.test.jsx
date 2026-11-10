import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TeacherParentLinks from './TeacherParentLinks';

vi.mock('../../api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));
import api from '../../api';

describe('parent link deletion', () => {
  it('offers deletion only for expired or disabled links and refreshes the library', async () => {
    const student = { id: 'student', name: 'Linh', centerName: 'Sunrise', centerId: 'center' };
    api.get.mockResolvedValue({ data: { data: [
      { id: 'homework:1', kind: 'homework', title: 'Expired work', status: 'expired', student, createdAt: new Date() },
      { id: 'family:2', kind: 'family', title: 'Disabled page', status: 'disabled', student, createdAt: new Date() },
      { id: 'quiz:3', kind: 'quiz', title: 'Active quiz', status: 'active', student, createdAt: new Date() },
    ], pagination: { total: 3, totalPages: 1 } } });
    api.delete.mockResolvedValue({});
    render(<TeacherParentLinks centers={[]} students={[]} busy={false} run={fn => fn()} copy={vi.fn()} onOpenTool={vi.fn()} />);
    const expired = (await screen.findByText('Expired work')).closest('article');
    const active = screen.getByText('Active quiz').closest('article');
    expect(within(active).queryByRole('button', { name: 'Delete link' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Delete link' })).toHaveLength(2);
    fireEvent.click(within(expired).getByRole('button', { name: 'Delete link' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/parent-links/homework/1'));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });
});
