import api from '../../api';
import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { ClassHandoffContext } from './ClassHandoffContext';
import { waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React, { useEffect } from 'react';
import { it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LiveStudioFrame, { StudioDashboardButton } from './LiveStudioFrame';
vi.mock('../../api', () => ({ default: { get: vi.fn(async () => ({ data: { data: [] } })) } }));
vi.mock('../teacher-mode/TeacherModeDashboard', () => ({ default: ({ liveBookingId, onReturnToClass }) => <button onClick={onReturnToClass}>Resume {liveBookingId}</button> }));
it('keeps the classroom mounted while visiting the dashboard and returning', async () => {
  const mounted = vi.fn(), stopped = vi.fn();
  function Session() { useEffect(() => { mounted(); return stopped; }, []); return <><StudioDashboardButton /><div>Live recording</div></>; }
  const view = render(<MemoryRouter><LiveStudioFrame enabled bookingId="lesson-1"><Session /></LiveStudioFrame></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
  expect(await screen.findByRole('button', { name: 'Resume lesson-1' })).toBeVisible();
  expect(screen.getByText('Live recording')).not.toBeVisible();
  expect(stopped).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Resume lesson-1' }));
  expect(screen.getByText('Live recording')).toBeVisible();
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(stopped).not.toHaveBeenCalled();
  view.unmount();
  expect(stopped).toHaveBeenCalledTimes(1);
});
it('leaves regular center classrooms unchanged', () => {
  render(<MemoryRouter><LiveStudioFrame enabled={false}><div>Regular class</div></LiveStudioFrame></MemoryRouter>);
  expect(screen.getByText('Regular class')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Back to dashboard' })).toBeNull();
});

function RouteProbe() { const route = useLocation(); return <div data-testid="route">{route.pathname}:{route.state?.classData?.bookingId}</div>; }
function FakeRecorder({ prepare, finish = async () => ({ completed: true }) }) {
  const context = useContext(ClassHandoffContext);
  useEffect(() => { context.recorder.current = { prepareHandoff: prepare }; context.finishClass.current = finish; }, [context, prepare, finish]);
  return <StudioDashboardButton />;
}
const bookings = (status = 'completed') => [
  { _id: 'old', status, scheduledTime: new Date(Date.now() - 30 * 60000).toISOString(), duration: 30 },
  { _id: 'new', status: 'accepted', scheduledTime: new Date().toISOString(), duration: 30, classTitle: 'Reading' },
];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
it('asks before ending a live class and leaves it running on cancel', async () => {
  api.get.mockResolvedValue({ data: { data: bookings('accepted') } });
  const prepare = vi.fn(), finish = vi.fn();
  render(<MemoryRouter><LiveStudioFrame enabled bookingId="old" provider="googlemeet"><FakeRecorder prepare={prepare} finish={finish} /></LiveStudioFrame><RouteProbe /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Next class' }));
  expect(await screen.findByRole('dialog')).toHaveTextContent('End this class and switch?');
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  expect(prepare).not.toHaveBeenCalled(); expect(finish).not.toHaveBeenCalled();
  expect(screen.getByTestId('route')).not.toHaveTextContent('/classroom:new');
});
it('saves the recording and awaits the class outcome after Yes before switching', async () => {
  api.get.mockResolvedValue({ data: { data: bookings('accepted') } });
  const events = []; let settle;
  const prepare = vi.fn(async () => { events.push('recording saved'); });
  const finish = vi.fn(() => { events.push('ending class'); return new Promise(resolve => { settle = resolve; }); });
  render(<MemoryRouter><LiveStudioFrame enabled bookingId="old" provider="googlemeet"><FakeRecorder prepare={prepare} finish={finish} /></LiveStudioFrame><RouteProbe /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Next class' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, end class and switch' }));
  await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
  expect(events).toEqual(['recording saved', 'ending class']);
  expect(screen.getByTestId('route')).not.toHaveTextContent('/classroom:new');
  await act(async () => { settle({ completed: true }); });
  expect(screen.getByTestId('route')).toHaveTextContent('/classroom:new');
});
it('does not switch if ending the class fails', async () => {
  api.get.mockResolvedValue({ data: { data: bookings('accepted') } });
  render(<MemoryRouter><LiveStudioFrame enabled bookingId="old" provider="googlemeet"><FakeRecorder prepare={vi.fn()} finish={vi.fn().mockRejectedValue(new Error('Could not save attendance'))} /></LiveStudioFrame><RouteProbe /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Next class' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, end class and switch' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save attendance');
  expect(screen.getByTestId('route')).not.toHaveTextContent('/classroom:new');
});
it('waits for durable recording storage and ignores repeated clicks', async () => {
  api.get.mockResolvedValue({ data: { data: bookings() } });
  let stored;
  const prepare = vi.fn(() => new Promise(resolve => { stored = resolve; }));
  render(<MemoryRouter><LiveStudioFrame enabled bookingId="old" provider="googlemeet"><FakeRecorder prepare={prepare} /></LiveStudioFrame><RouteProbe /></MemoryRouter>);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Keep shared tab' }));
  const button = screen.getByRole('button', { name: 'Next class' });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(prepare).toHaveBeenCalledWith('new', true));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('route')).not.toHaveTextContent('/classroom:new');
  await act(async () => { stored(); });
  expect(screen.getByTestId('route')).toHaveTextContent('/classroom:new');
});
it('stays on the current page if recording storage fails', async () => {
  api.get.mockResolvedValue({ data: { data: bookings() } });
  const prepare = vi.fn().mockRejectedValue(new Error('Recording storage unavailable'));
  render(<MemoryRouter><LiveStudioFrame enabled bookingId="old" provider="googlemeet"><FakeRecorder prepare={prepare} /></LiveStudioFrame><RouteProbe /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Next class' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Recording storage unavailable');
  expect(screen.getByTestId('route')).not.toHaveTextContent('/classroom:new');
});
