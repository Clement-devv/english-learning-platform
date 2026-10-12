// src/lib/sentryReplay.js
// Imported lazily from main.jsx so Sentry's session-replay code (~300 KB) is
// not part of the first download.
export { replayIntegration } from '@sentry/react';
