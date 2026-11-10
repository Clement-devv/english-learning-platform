import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import FamilySchedule from './FamilySchedule';

it('lets a family switch between upcoming, earlier and completed classes', async () => {
  const request = vi.fn(async () => ({ data: { data: { classes: [], totalPages: 1 } } }));
  function Page() { const [view, setView] = useState('upcoming'); return <FamilySchedule request={request} view={view} onView={setView} />; }
  render(<Page />);
  expect(await screen.findByText('No classes scheduled for today or later.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Previous dates' }));
  expect(await screen.findByText('No classes on previous dates.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Completed classes' }));
  expect(await screen.findByText('No completed classes yet.')).toBeInTheDocument();
  await waitFor(() => expect(request.mock.calls.some(([method, path]) => method === 'get' && path.includes('view=completed'))).toBe(true));
});
