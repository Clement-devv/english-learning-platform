import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FamilyClassUpdates from './FamilyClassUpdates';
import FamilyRecordings from './FamilyRecordings';

describe('family page older items', () => {
  it('reveals older class reviews on request', async () => {
    const request = vi.fn(async (_method, url) => ({ data: { data: url.endsWith('page=1') ? { items: [{ _id: '1', title: 'Newest review' }, { _id: '2', title: 'Second review' }], hasMore: true } : { items: [{ _id: '3', title: 'Older review' }], hasMore: false } } }));
    render(<FamilyClassUpdates work={[]} request={request} run={vi.fn()} busy={false} />);
    expect(await screen.findByText('Newest review')).toBeInTheDocument();
    expect(screen.queryByText('Older review')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show older class reviews' }));
    expect(await screen.findByText('Older review')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older class reviews' })).not.toBeInTheDocument();
  });
  it('reveals older recording sessions on request', async () => {
    const request = vi.fn(async (_method, url) => ({ data: { data: url.endsWith('page=1') ? { items: [{ id: '1', title: 'Newest recording' }], hasMore: true } : { items: [{ id: '2', title: 'Older recording' }], hasMore: false } } }));
    render(<FamilyRecordings request={request} base="/family" access="token" />);
    expect(await screen.findByText('Newest recording')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show older recordings' }));
    expect(await screen.findByText('Older recording')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older recordings' })).not.toBeInTheDocument();
  });
});
