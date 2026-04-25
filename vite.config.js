import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  resolve: {
    // Guarantee a single React instance across all chunks (including @react-three/fiber/drei).
    // Without this, chunks split into vendor-three can load their own React copy, causing
    // "Cannot read properties of null (reading 'useState')" on first load.
    dedupe: ['react', 'react-dom', 'react-dom/client'],
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**'],
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },

  build: {
    // Warn at 600 KB instead of default 500 KB
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Heavy standalone libs ─────────────────────────────────────────
          if (id.includes('agora-rtc-sdk-ng') || id.includes('agora-extension')) {
            return 'vendor-agora';
          }
          if (id.includes('node_modules/three') || id.includes('@react-three')) {
            return 'vendor-three';
          }
          if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
            return 'vendor-jspdf';
          }
          if (id.includes('pdfjs-dist')) {
            return 'vendor-pdfjs';
          }
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }
          if (id.includes('framer-motion')) {
            return 'vendor-framer';
          }
          if (id.includes('emoji-picker-react')) {
            return 'vendor-emoji';
          }

          // ── Core React + Router ───────────────────────────────────────────
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('react-router-dom')
          ) {
            return 'vendor-react';
          }

          // ── All other node_modules ────────────────────────────────────────
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
})
