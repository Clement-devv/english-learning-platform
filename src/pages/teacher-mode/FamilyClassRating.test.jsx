import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FamilyClassRating from './FamilyClassRating';

describe('family class rating', () => {
  it('submits a rating and optional feedback for the selected class', async () => {
    const request = vi.fn().mockResolvedValue({});
    const onSaved = vi.fn().mockResolvedValue();
    render(<FamilyClassRating lesson={{ id: 'class-1', group: true }} request={request} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rate your teacher' }));
    fireEvent.change(screen.getByLabelText('Rating'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Feedback for the teacher (optional)'), { target: { value: 'Thank you' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send review' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('post', '/schedule/class-1/review', { group: true, rating: 4, comment: 'Thank you' }));
    expect(onSaved).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
  });
});
