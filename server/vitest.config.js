import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Point envDir to tests/ so Vite doesn't try to read server/.env
  envDir: './tests',
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
    // Each file starts its own in-memory MongoDB in beforeAll; with several
    // files running in parallel that can take longer than the 10 s default.
    hookTimeout: 120000,
  },
})
