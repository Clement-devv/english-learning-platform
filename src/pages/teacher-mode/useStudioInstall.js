import { useLayoutEffect } from 'react';

export function useStudioInstall(dark = false) {
  useLayoutEffect(() => {
    const tag = document.querySelector('meta[name="theme-color"]');
    if (!tag) return;
    const previous = tag.content;
    tag.content = dark ? '#20231e' : '#f3f0e8';
    return () => { tag.content = previous; };
  }, [dark]);
  useLayoutEffect(() => {
    const tags = [
      ['link[rel="manifest"]', 'href', '/ego-studio/manifest.webmanifest'],
      ['link[rel="icon"]', 'href', '/ego-studio/icon-64.png'],
      ['link[rel="apple-touch-icon"]', 'href', '/ego-studio/icon-180.png'],
      ['meta[name="apple-mobile-web-app-title"]', 'content', 'E.G.O Teacher Studio'],
    ];
    const restore = [];
    for (const [selector, attr, value] of tags) {
      const tag = document.querySelector(selector);
      if (!tag) continue;
      const original = tag.getAttribute(attr);
      tag.setAttribute(attr, value);
      restore.push(() => tag.setAttribute(attr, original));
    }
    const title = document.title;
    document.title = 'E.G.O Teacher Studio';
    return () => {
      restore.forEach(reset => reset());
      document.title = title;
    };
  }, []);
}
