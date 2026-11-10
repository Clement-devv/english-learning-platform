import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FamilyVideoPlayer from './FamilyVideoPlayer';

it('orders recording parts and advances to the next part when playback ends', async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const recordings = [{ id: 'second', sessionId: 'session', partNumber: 2, source: 'app', local: true, duration: 120 }, { id: 'first', sessionId: 'session', partNumber: 1, source: 'app', local: true, duration: 480 }];
  const { container } = render(<FamilyVideoPlayer recordings={recordings} base="/family" access="token" />);
  expect(container.querySelector('video')).toHaveAttribute('src', '/family/recordings/first?a=token');
  expect(screen.getByText(/approximately 10:00 total/)).toBeInTheDocument();
  fireEvent.ended(container.querySelector('video'));
  await waitFor(() => expect(container.querySelector('video')).toHaveAttribute('src', '/family/recordings/second?a=token'));
  expect(play).toHaveBeenCalled();
  play.mockRestore();
});

it('keeps the video closed until the parent chooses to watch', () => {
  const { container } = render(<FamilyVideoPlayer recordings={[{ id: 'v1', source: 'app', local: true }]} base="/family" access="token" collapsed />);
  expect(container.querySelector('video')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Watch recording' }));
  expect(container.querySelector('video')).toHaveAttribute('src', '/family/recordings/v1?a=token');
  fireEvent.click(screen.getByRole('button', { name: 'Close recording' }));
  expect(container.querySelector('video')).toBeNull();
});
