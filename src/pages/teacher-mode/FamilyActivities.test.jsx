import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FamilyActivities from './FamilyActivities';

it('shows graded homework and completed quiz results on the family page', () => {
  render(<FamilyActivities activities={[
    { id: 'h1', kind: 'hw', title: 'Reading', status: 'graded', grade: { score: 88, feedback: 'Well done.' }, url: '/hw/token' },
    { id: 'q1', kind: 'q', title: 'Vocabulary', status: 'attempted', result: { score: 4, totalQuestions: 5, percentage: 80 }, url: null },
  ]} />);
  expect(screen.getByText('Score: 88%')).toBeInTheDocument();
  expect(screen.getByText('Well done.')).toBeInTheDocument();
  expect(screen.getByText('4 of 5 correct · 80%')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Reading' })).toHaveAttribute('href', '/hw/token');
  expect(screen.getByText(/activity link has expired/i)).toBeInTheDocument();
});
