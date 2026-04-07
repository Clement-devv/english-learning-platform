// Global type declarations for the English Learning Platform.
// New .ts / .tsx files will be type-checked automatically.
// Existing .jsx / .js files are not checked until explicitly converted.

/// <reference types="vite/client" />

// Extend Window with any globals injected at runtime
interface Window {
  __APP_VERSION__?: string
}
