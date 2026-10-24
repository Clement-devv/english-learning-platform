import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClassicTemplate from './templates/ClassicTemplate';
import ModernTemplate from './templates/ModernTemplate';
import ComingSoonPage from './ComingSoonPage';
import { classicSample, classicExampleStrings } from './classicContent';
import { CountUp } from './templates/shared.jsx';

const center = { centerName: 'Emac English', slug: 'emac' };
afterEach(cleanup);

describe('Vietnamese websites', () => {
  for (const [name, Template] of [['Classic', ClassicTemplate], ['Modern', ModernTemplate]]) {
    it(`${name}: built-in words are Vietnamese and the page is marked lang="vi"`, () => {
      const lp = { ...classicSample('Emac English', 'vi'), template: name.toLowerCase(), language: 'vi', links: {} };
      const { container } = render(<Template center={center} lp={lp} />);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Tự tin giao tiếp tiếng Anh/);
      expect(container.querySelector('[lang="vi"]')).toBeTruthy();
      expect(document.documentElement.lang).toBe('vi');
      const text = container.textContent;
      for (const word of ['Đăng nhập', 'Khóa học', 'Đang tuyển sinh', 'Vận hành bởi Clemify']) expect(text, word).toContain(word);
      for (const word of ['Log in', 'Login', 'Enrolment open', 'Powered by']) expect(text, word).not.toContain(word);
    });

    it(`${name}: English stays the default for websites saved before the setting`, () => {
      const lp = { ...classicSample('Emac English'), template: name.toLowerCase(), links: {} };
      const { container } = render(<Template center={center} lp={lp} />);
      expect(container.textContent).toContain('Powered by Clemify');
      expect(document.documentElement.lang).toBe('en');
    });
  }

  it('coming-soon page follows the language', () => {
    render(<MemoryRouter><ComingSoonPage center={{ centerName: 'Emac', language: 'vi' }} /></MemoryRouter>);
    expect(screen.getByText('Website sắp ra mắt')).toBeTruthy();
    expect(screen.getByText('Học viên đăng nhập')).toBeTruthy();
  });

  it('the Vietnamese sample has the same shape as the English one', () => {
    const shape = (v) => Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
    expect(shape(classicSample('X', 'vi'))).toEqual(shape(classicSample('X', 'en')));
  });

  it('example content is recognised in both languages', () => {
    const ex = classicExampleStrings('Emac');
    expect(ex.hero.has(classicSample('Emac', 'vi').hero.headline)).toBe(true);
    expect(ex.hero.has(classicSample('Emac', 'en').hero.headline)).toBe(true);
    expect(ex.stats.has('1.200+')).toBe(true);
  });
});

describe('CountUp keeps the number style that was typed', () => {
  for (const v of ['1,200+', '1.200+', '98%', '4.5', '4,5', '1200', 'Online', '1.500.000đ']) {
    it(v, () => {
      const { container } = render(<CountUp value={v} />);
      expect(container.textContent).toBe(v); // jsdom has no IntersectionObserver → shows the real value
    });
  }
});
