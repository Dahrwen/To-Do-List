/**
 * ============================================================================
 * FILE: vite.config.js
 * ============================================================================
 * PURPOSE:
 *   Configures the Vite development server and production Rollup bundler for
 *   this React 18 Single Page Application (SPA).
 *
 * CORE RESPONSIBILITIES:
 *   1. Enables the official `@vitejs/plugin-react` plugin for Fast Refresh
 *      (Hot Module Replacement) and JSX/TSX compilation.
 *   2. Automatically loads client-safe environment variables prefixed with
 *      `VITE_` from `.env` / `.env.local` into `import.meta.env`.
 *
 * IMPORTS FROM:
 *   - 'vite': `defineConfig` helper for type-safe configuration
 *   - '@vitejs/plugin-react': React compiler and HMR plugin
 *
 * EXPORTS TO:
 *   - Consumed automatically by the Vite CLI (`npm run dev`, `npm run build`, `npm run preview`)
 * ============================================================================
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Export the Vite configuration object used during local development and bundling
export default defineConfig({
  // Register the React plugin so `.jsx` files are compiled without needing manual Babel setup
  plugins: [react()],
});
