import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClassicTemplate from './ClassicTemplate';
import { classicSample } from '../classicContent';

const center = { centerName: 'Emac English', slug: 'emac' };

describe('ClassicTemplate', () => {
  it('renders every section from the sample content', () => {
    const lp = { template: 'classic', ...classicSample('Emac English'), contact: { enabled: true, phone: '+84 90 123 4567', address: '12 Tran Hung Dao, Hanoi' }, links: {} };
    const { container } = render(<ClassicTemplate center={center} lp={lp} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Speak English with confidence/);
    for (const id of ['home', 'about', 'programs', 'teachers', 'testimonials', 'faq', 'contact']) {
      expect(container.querySelector(`#${id}`), id).toBeTruthy();
    }
    expect(screen.getAllByText('IELTS Preparation').length).toBe(2); // program card + footer list
    expect(screen.getByText('Grace Mensah')).toBeTruthy();
    expect(container.querySelectorAll('.ct-gallery-item').length).toBe(5);
    expect(container.querySelectorAll('.ct-highlight').length).toBe(3); // first three "why us" items
    const maps = container.querySelector('a[href^="https://www.google.com/maps/search/"]');
    expect(maps.getAttribute('target')).toBe('_blank');
  });

  it('hides empty sections and still renders a complete page', () => {
    const { container } = render(<ClassicTemplate center={center} lp={{ template: 'classic', links: {}, teachers: [] }} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Emac English/);
    for (const id of ['about', 'programs', 'teachers', 'testimonials', 'faq', 'contact']) {
      expect(container.querySelector(`#${id}`), id).toBeNull();
    }
    expect(container.querySelector('footer')).toBeTruthy();
    // nav only links to sections that exist
    expect([...container.querySelectorAll('.ct-nav a')].map(a => a.textContent)).toEqual(['Home']);
  });

  it('respects switched-off sections', () => {
    const sample = classicSample('Emac English');
    const lp = { ...sample, programs: { ...sample.programs, enabled: false }, faq: { ...sample.faq, enabled: false }, links: {} };
    const { container } = render(<ClassicTemplate center={center} lp={lp} />);
    expect(container.querySelector('#programs')).toBeNull();
    expect(container.querySelector('#faq')).toBeNull();
    expect(container.querySelector('#testimonials')).toBeTruthy();
  });
});
