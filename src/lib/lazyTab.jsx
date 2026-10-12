// src/lib/lazyTab.jsx
// Load a dashboard tab only when it is first opened, instead of bundling every
// tab into the dashboard's initial download.
//
// lazyTab() returns a drop-in replacement for the real component: same props,
// but it carries its own <Suspense>, so a shell can swap
//   import QuizTab from '../tabs/QuizTab';
// for
//   const QuizTab = lazyTab(() => import('../tabs/QuizTab'));
// without touching its layout. While the tab's code downloads, a small spinner
// shows in the tab area only — the sidebar and header stay put.

/* eslint-disable react-refresh/only-export-components -- helper module, not a component file */
import { lazy, Suspense } from 'react';

function TabLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
      <style>{`@keyframes lazytab-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '3px solid rgba(148,163,184,0.25)',
        borderTopColor: 'var(--brand-primary, #6366f1)',
        animation: 'lazytab-spin 0.75s linear infinite',
      }} />
    </div>
  );
}

export function lazyTab(load) {
  const Lazy = lazy(load);
  function LazyTab(props) {
    return (
      <Suspense fallback={<TabLoader />}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  LazyTab.preload = load;
  return LazyTab;
}

// Once the dashboard is up and the browser is idle, fetch the remaining tabs
// in the background so clicking one later is instant. The delay keeps these
// downloads from competing with the dashboard's own API calls.
export function preloadWhenIdle(tabs, delayMs = 3000) {
  const run = () => tabs.forEach((t) => t.preload().catch(() => {}));
  setTimeout(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 5000 });
    else run();
  }, delayMs);
}
