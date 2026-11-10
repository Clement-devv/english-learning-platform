import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FamilyJoinClass from './FamilyJoinClass';

it('shows the parent the selected classroom link', async () => {
  const request = vi.fn(async () => ({ data: { data: { ready: true, provider: 'googlemeet', url: 'https://meet.google.com/abc-defg-hij' } } }));
  render(<FamilyJoinClass lesson={{ id: 'c1', group: false }} request={request} />);
  fireEvent.click(screen.getByRole('button', { name: 'Join class' }));
  expect(await screen.findByRole('link', { name: /Open Google Meet classroom/ })).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
  expect(request).toHaveBeenCalledWith('get', '/schedule/c1/join?group=false');
});
