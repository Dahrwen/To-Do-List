/**
 * ============================================================================
 * FILE: vite.config.js
 * ============================================================================
 * PURPOSE:
 *   Configures the Vite development server, preview server, and production
 *   Rollup bundler for this React 18 Single Page Application (SPA).
 *
 * CORE RESPONSIBILITIES:
 *   1. Enables the official `@vitejs/plugin-react` plugin for Fast Refresh
 *      (Hot Module Replacement) and JSX/TSX compilation.
 *   2. Automatically loads client-safe environment variables prefixed with
 *      `VITE_` from `.env` / `.env.local` into `import.meta.env`.
 *   3. Mounts server-only middleware (`POST /api/gemini-announcement`) so
 *      `GEMINI_API_KEY` stays strictly in Node memory and never leaks into the
 *      client bundle.
 * ============================================================================
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createGeminiMiddleware } from './src/server/geminiAnnouncementHandler.js';

function geminiAnnouncementApiPlugin() {
  let serverGeminiKey = process.env.GEMINI_API_KEY || '';

  return {
    name: 'gemini-announcement-api-middleware',
    config(_, { mode }) {
      // Load ALL env vars server-side (empty prefix) without exposing non-VITE_ keys to the browser
      const env = loadEnv(mode, process.cwd(), '');
      if (env.GEMINI_API_KEY) {
        serverGeminiKey = env.GEMINI_API_KEY;
        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
      }
    },
    configureServer(server) {
      server.middlewares.use(createGeminiMiddleware(() => serverGeminiKey));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createGeminiMiddleware(() => serverGeminiKey));
    },
  };
}

// Export the Vite configuration object used during local development and bundling
export default defineConfig({
  plugins: [react(), geminiAnnouncementApiPlugin()],
});
