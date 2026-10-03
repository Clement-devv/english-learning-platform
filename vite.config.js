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

  // Dev server: pre-bundle these at startup. Vite's import scan misses them
  // (they're only reached through lazily loaded tabs), so it used to find them
  // mid-session, re-bundle, and serve them with a NEW React copy while the page
  // still ran the old one → "Cannot read properties of null (reading 'useState')"
  // in the admin Overview (AnimatedStatCard / AnimatedButton use framer-motion).
  //
  // So pre-bundle EVERY package the app imports — not just the two that bit us
  // first. If you add a new package used only inside a lazy tab, add it here too,
  // or restart the dev server with `npx vite --force` after installing it.
  optimizeDeps: {
    include: [
      'react', 'react-dom/client', 'react-dom/server', 'react-router-dom',
      '@tanstack/react-query', 'axios', 'socket.io-client', 'lucide-react',
      'i18next', 'react-i18next', '@sentry/react',
      'framer-motion', 'recharts', 'react-confetti', 'emoji-picker-react',
      'three', '@react-three/fiber', '@react-three/drei',
      'jspdf', 'jspdf-autotable', 'pdfjs-dist',
      'agora-rtc-sdk-ng', 'agora-extension-virtual-background',
    ],
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

          // React and all React-ecosystem packages intentionally left unsplit.
          // Putting them in a separate chunk creates circular dependencies with
          // vendor-misc (e.g. @sentry/react → @sentry/browser → back), causing
          // React to be undefined when createContext is called at init time.
          // Let Vite bundle them into the main app chunk — they're small.
        },
      },
    },
  },
})
