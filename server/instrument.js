// Sentry must be initialized before any other module is imported.
// With ESM, import statements are hoisted — so Sentry.init() inside index.js
// runs AFTER express/mongoose are already loaded, which prevents instrumentation.
// Loading this file via `node --import ./instrument.js` makes it execute before
// the module graph of index.js is resolved, so Sentry can patch all dependencies.
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as Sentry from '@sentry/node';

// Load .env early so SENTRY_DSN and NODE_ENV are available here.
// dotenv.config() is idempotent — calling it again in config.js is harmless.
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
config({ path: resolve(__dirname, '.env') });

// Off unless explicitly switched on with SENTRY_ENABLED=true (in server/.env),
// so day-to-day development doesn't use up the Sentry quota. While off, every
// Sentry call in the app (captureMessage, the Express error handler) is a no-op.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN && process.env.SENTRY_ENABLED === 'true',
});
