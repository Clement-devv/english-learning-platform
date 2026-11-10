import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FamilyLessonMaterials from './FamilyLessonMaterials';

it('opens the review and recording beside their completed lesson', async () => {
  const request = vi.fn(async () => ({ data: { data: { review: 'Practised reading aloud.', recordings: [{ id: 'v1', title: 'Lesson replay', url: 'https://example.com/replay' }] } } }));
  render(<FamilyLessonMaterials lesson={{ id: 'c1', group: false, hasReview: true, hasRecordings: true }} request={request} base="/family/token" access="access" />);
  fireEvent.click(screen.getByRole('button', { name: 'View class review' }));
  expect(await screen.findByText('Practised reading aloud.')).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('get', '/schedule/c1/materials?group=false');
  fireEvent.click(screen.getByRole('button', { name: 'Watch recording' }));
  expect(await screen.findByRole('link', { name: /Open recording/ })).toHaveAttribute('href', 'https://example.com/replay');
});
