import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { lazyTab } from './lazyTab';

describe('lazyTab', () => {
  it('renders the loaded component with its props', async () => {
    const Tab = lazyTab(() => Promise.resolve({ default: ({ name }) => <p>Hello {name}</p> }));
    render(<Tab name="Ana" />);
    expect(await screen.findByText('Hello Ana')).toBeInTheDocument();
  });

  it('exposes preload() that triggers the same import', async () => {
    const load = vi.fn(() => Promise.resolve({ default: () => <p>x</p> }));
    const Tab = lazyTab(load);
    await Tab.preload();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
