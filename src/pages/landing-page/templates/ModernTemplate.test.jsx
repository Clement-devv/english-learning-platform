import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ModernTemplate from './ModernTemplate';
import { classicSample } from '../classicContent';

const center = { centerName: 'Emac English', slug: 'emac' };

describe('ModernTemplate', () => {
  it('renders every section from the same content as Classic', () => {
    const lp = { template: 'modern', ...classicSample('Emac English'), contact: { enabled: true, phone: '+84 90 123 4567', address: '12 Tran Hung Dao, Hanoi' }, links: {} };
    const { container } = render(<ModernTemplate center={center} lp={lp} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Speak English with confidence/);
    expect(container.querySelector('h1 .md-grad').textContent).toBe('confidence'); // longest word highlighted
    for (const id of ['home', 'about', 'programs', 'teachers', 'testimonials', 'faq', 'contact']) {
      expect(container.querySelector(`#${id}`), id).toBeTruthy();
    }
    expect(container.querySelectorAll('.md-program').length).toBe(6);
    expect(container.querySelectorAll('.md-feature.is-wide').length).toBe(2); // 1st and 6th
    expect(container.querySelectorAll('.md-quote.is-feature').length).toBe(1);
    expect(container.querySelectorAll('.md-gallery-item').length).toBe(5);
    // ticker: the second copy is for the seamless loop only
    expect(container.querySelector('.md-ticker-set[aria-hidden="true"]')).toBeTruthy();
    const maps = container.querySelector('a[href^="https://www.google.com/maps/search/"]');
    expect(maps.getAttribute('target')).toBe('_blank');
  });

  it('hides empty sections and still renders a complete page', () => {
    const { container } = render(<ModernTemplate center={center} lp={{ template: 'modern', links: {}, teachers: [] }} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Emac English/);
    for (const id of ['about', 'programs', 'teachers', 'testimonials', 'faq', 'contact']) {
      expect(container.querySelector(`#${id}`), id).toBeNull();
    }
    expect(container.querySelector('.md-ticker')).toBeNull();
    expect(container.querySelector('footer')).toBeTruthy();
  });

  it('respects switched-off sections', () => {
    const sample = classicSample('Emac English');
    const lp = { ...sample, template: 'modern', programs: { ...sample.programs, enabled: false }, faq: { ...sample.faq, enabled: false }, links: {} };
    const { container } = render(<ModernTemplate center={center} lp={lp} />);
    expect(container.querySelector('#programs')).toBeNull();
    expect(container.querySelector('#faq')).toBeNull();
    expect(container.querySelector('#testimonials')).toBeTruthy();
  });
});
