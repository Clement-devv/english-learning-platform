import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ManualCompletionNotice from './ManualCompletionNotice';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
it('scrolls both notices and removes each at its own 48-hour deadline', () => {
  vi.useFakeTimers();
  try {
    const start = Date.UTC(2026, 10, 15);
    vi.setSystemTime(start);
    const lessons = ['Reading', 'Writing'].map((title, i) => ({
      _id: title, title, scheduledTime: start, completedAt: new Date(start - (47 - i) * 3600000).toISOString(),
    }));
    render(<ManualCompletionNotice lessons={lessons} />);
    expect(screen.getByText(/Reading/)).toBeInTheDocument();
    expect(screen.getByText(/Writing/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3600000));
    expect(screen.queryByText(/Reading/)).toBeNull();
    expect(screen.getByText(/Writing/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3600000));
    expect(screen.queryByText(/Writing/)).toBeNull();
  } finally { vi.useRealTimers(); }
});
