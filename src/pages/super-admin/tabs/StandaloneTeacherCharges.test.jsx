import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StandaloneTeacherCharges from './StandaloneTeacherCharges';

describe('standalone salary charges', () => {
  it('loads existing settings and saves percentages and fixed amounts in the server units', async () => {
    const call = vi.fn(async (_url, method) => method ? {} : { rules: [{ name: 'Platform', kind: 'percent', value: 1000, currency: '' }] });
    render(<StandaloneTeacherCharges teacher={{ _id: 'teacher1', name: 'Amara' }} call={call} onClose={vi.fn()} panel={{}} button={{}} field={{}} />);
    expect(await screen.findByDisplayValue('10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add charge' }));
    fireEvent.change(screen.getAllByLabelText('Name')[1], { target: { value: 'Service' } });
    fireEvent.change(screen.getAllByLabelText('Type')[1], { target: { value: 'fixed' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save charges' }));
    await waitFor(() => expect(call).toHaveBeenCalledWith('/workspaces/teacher1/charges', 'PUT', { rules: [{ name: 'Platform', kind: 'percent', value: 1000, currency: '' }, { name: 'Service', kind: 'fixed', value: 250, currency: 'USD' }] }));
  });
  it('allows a charge to apply only to selected managed centers', async () => {
    const call = vi.fn(async (_url, method) => method ? {} : { rules: [{ name: 'Platform', kind: 'percent', value: 1000 }], centers: [{ _id: 'a', name: 'Sunrise' }, { _id: 'b', name: 'River' }] });
    render(<StandaloneTeacherCharges teacher={{ _id: 'teacher1', name: 'Amara' }} call={call} onClose={vi.fn()} panel={{}} button={{}} field={{}} />);
    await screen.findByDisplayValue('Platform');
    fireEvent.change(screen.getByLabelText('Apply to'), { target: { value: 'selected' } });
    fireEvent.click(screen.getByLabelText('Sunrise'));
    fireEvent.click(screen.getByRole('button', { name: 'Save charges' }));
    await waitFor(() => expect(call).toHaveBeenCalledWith('/workspaces/teacher1/charges', 'PUT', { rules: [{ name: 'Platform', kind: 'percent', value: 1000, currency: '', centerIds: ['a'] }] }));
  });
});
