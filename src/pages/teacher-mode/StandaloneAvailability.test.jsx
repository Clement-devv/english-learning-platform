import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../api', () => ({ default: { get: vi.fn(async () => ({ data: { hasHours: true, timezone: 'Africa/Lagos', workingHours: [], free: [], blocks: [{ id: 'b', kind: 'booked', title: 'Booked lesson' }, { id: 'o', kind: 'off', note: 'Holiday' }] } })) } }));
vi.mock('../../hooks/useLiveData', () => ({ useOnDataChanged: () => {} }));
vi.mock('../../components/schedule/WeekCalendar', () => ({ default: ({ items }) => <div>{items.map(i => <p key={i.id}>{i.title}</p>)}</div>, Legend: () => null }));
import ScheduleTab from '../teacher/tabs/ScheduleTab';

it('shows time off but hides booked lessons in the standalone availability calendar', async () => {
  render(<ScheduleTab studio teacherInfo={{ _id: 'teacher', timezone: 'Africa/Lagos' }} students={[]} />);
  expect(await screen.findByText('Holiday')).toBeInTheDocument();
  expect(screen.queryByText('Booked lesson')).not.toBeInTheDocument();
  expect(screen.queryByText('Booked', { exact: true })).not.toBeInTheDocument();
});
