import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import StandaloneEarningsTab from './StandaloneEarningsTab';

afterEach(() => vi.unstubAllGlobals());
describe('standalone earnings overview', () => {
  it('shows teacher earnings, center charges and their monthly details', async () => {
    const total = { currency: 'USD', earned: 10000, chargesTotal: 1000, net: 9000, received: 0, outstanding: 9000, lessons: 1, charges: [{ month: '2026-11', name: 'Platform', kind: 'percent', value: 1000, amountMinor: 1000 }] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { totals: [total], teachers: [{ id: 't', name: 'Amara', email: 'a@example.com', centers: [{ _id: 'c', name: 'Sunrise', totals: [total] }] }] } }) })));
    render(<StandaloneEarningsTab apiBase="/api" authHeaders={{ Authorization: 'Bearer admin' }} />);
    const summary = (await screen.findByText('Amara')).closest('details');
    expect(within(summary).getByText('Sunrise · 1 completed class')).toBeInTheDocument();
    fireEvent.click(within(summary).getByText('Amara'));
    expect(within(summary).getByText('2026-11 · Platform (10%)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search earnings'), { target: { value: 'unknown' } });
    expect(screen.getByText('No earnings match these filters.')).toBeInTheDocument();
  });
});
