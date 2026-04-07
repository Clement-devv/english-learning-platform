import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Point envDir to tests/ so Vite doesn't try to read server/.env
  envDir: './tests',
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
  },
})
