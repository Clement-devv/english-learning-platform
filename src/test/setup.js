import '@testing-library/jest-dom';

// Polyfill import.meta.env for tests
if (!globalThis.import) {
  globalThis.import = { meta: { env: {} } };
}

// Suppress noisy console output in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
