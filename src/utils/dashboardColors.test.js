import { describe, it, expect } from 'vitest';
import { dashboardColors } from './dashboardColors';

describe('dashboardColors', () => {
  it('returns distinct values for dark vs light mode', () => {
    const dark  = dashboardColors(true);
    const light = dashboardColors(false);
    expect(dark.bg).not.toBe(light.bg);
    expect(dark.card).not.toBe(light.card);
  });

  it('returns an object with all required keys', () => {
    const keys = ['bg', 'card', 'sidebar', 'border', 'heading', 'text', 'muted', 'activeBg', 'activeClr'];
    const colors = dashboardColors(false);
    keys.forEach(k => expect(colors).toHaveProperty(k));
  });

  it('dark mode uses a dark card color', () => {
    const { card } = dashboardColors(true);
    expect(card).toBe('#1a1d27');
  });

  it('light mode uses white as card color', () => {
    const { card } = dashboardColors(false);
    expect(card).toBe('#ffffff');
  });
});
