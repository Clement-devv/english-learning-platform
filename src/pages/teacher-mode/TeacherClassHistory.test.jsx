import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import TeacherClassHistory from './TeacherClassHistory';
import api from '../../api';
vi.mock('../../api', () => ({ default: { get: vi.fn() } }));
vi.mock('./studioLanguage', () => ({ studioText: (t) => t }));
const centers = [
  { _id: 'a', name: 'Academy A' },
  { _id: 'b', name: 'Academy B' },
];
function History() {
  const [center, setCenter] = useState('a');
  return (
    <TeacherClassHistory
      teacherInfo={{ id: 'teacher' }}
      centerId={center}
      centers={centers}
      onCenterChange={setCenter}
      onNavigate={() => {}}
    />
  );
}
it('retains the not-completed filter when switching centers and sends explicit center scope', async () => {
  api.get.mockImplementation(async (_url, { params }) => ({
    data: {
      classes: [
        {
          id: params.managedCenterId,
          title: 'Reading lesson',
          managedCenterId: params.managedCenterId,
          scheduledTime: '2026-11-10T10:00:00Z',
          duration: 45,
          officiallyCompleted: params.view === 'completed',
          students: [],
        },
      ],
      pagination: { totalPages: 1 },
    },
  }));
  render(<History />);
  await screen.findByRole('heading', { name: 'Reading lesson' });
  fireEvent.click(screen.getByRole('button', { name: 'Not completed', exact: true }));
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith(
      '/bookings/teacher/teacher/history',
      expect.objectContaining({
        params: expect.objectContaining({ view: 'not_completed', managedCenterId: 'a' }),
      })
    )
  );
  fireEvent.change(screen.getByLabelText('Center for class history'), { target: { value: 'b' } });
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith(
      '/bookings/teacher/teacher/history',
      expect.objectContaining({
        params: expect.objectContaining({ view: 'not_completed', managedCenterId: 'b' }),
      })
    )
  );
  expect(screen.getByRole('button', { name: 'Not completed', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(await screen.findByText('Academy B', { selector: 'strong' })).toBeInTheDocument();
});
