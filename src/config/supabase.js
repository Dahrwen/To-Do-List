/**
 * ============================================================================
 * FILE: src/config/supabase.js
 * ============================================================================
 * PURPOSE:
 *   Initializes and exports the singleton Supabase client instance and provides
 *   multi-layer recovery for the Google OAuth 2.0 `provider_token`.
 *
 * CORE RESPONSIBILITIES:
 *   1. Pre-Initialization URL Hash Capture:
 *      Captures `#provider_token=...` from `window.location.hash` BEFORE
 *      `createClient()` runs, because Supabase's internal `GoTrueClient`
 *      automatically strips the URL hash as soon as it initializes.
 *   2. Supabase Client Instantiation:
 *      Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` from `.env.local`
 *      via Vite's `import.meta.env` without hardcoding any credentials.
 *   3. Real-Time Auth Event Listener:
 *      Registers `supabase.auth.onAuthStateChange` at module load time to
 *      persist `session.provider_token` whenever a Google OAuth callback fires,
 *      and clears tokens upon `SIGNED_OUT`.
 *   4. Multi-Layer Token Resolver (`getGoogleProviderToken`):
 *      Checks the active session object, `sessionStorage`, `localStorage`, and
 *      Supabase's internal `sb-*-auth-token` storage entry so Google Classroom
 *      sync always has access to the active Google OAuth token.
 *
 * IMPORTS FROM:
 *   - '@supabase/supabase-js': Official Supabase JavaScript SDK (`createClient`)
 *
 * EXPORTS TO:
 *   - `src/App.jsx`: `supabase`, `getGoogleProviderToken`
 *   - `src/components/AuthModal.jsx`: `supabase`
 *   - `src/services/classroomSync.js`: `supabase`
 * ============================================================================
 */

// Import createClient helper from the official Supabase JavaScript SDK
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// STEP 1: PRE-INITIALIZATION OAUTH HASH CAPTURE
// ============================================================================
// When Google OAuth redirects back to the app (e.g., https://app/#access_token=...&provider_token=...),
// Supabase's GoTrueClient immediately parses and clears window.location.hash during createClient().
// We intercept the hash first so the Google OAuth `provider_token` is never lost.
if (typeof window !== 'undefined' && window.location.hash) {
  try {
    // Strip the leading '#' character and parse key-value parameters from the URL fragment
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const providerToken = hashParams.get('provider_token');

    // If Google returned a provider_token, cache it in browser storage for Classroom API calls
    if (providerToken) {
      sessionStorage.setItem('google_provider_token', providerToken);
      localStorage.setItem('google_provider_token', providerToken);
    }
  } catch (e) {
    console.warn('Could not parse provider_token from URL hash:', e);
  }
}

// ============================================================================
// STEP 2: SUPABASE CLIENT INSTANTIATION
// ============================================================================
// Read the Supabase project URL and anon public key from Vite's environment variables (.env.local).
// In Vite, only variables prefixed with "VITE_" are exposed to browser client code.
// Secret keys (like SUPABASE_SERVICE_ROLE_KEY or GOOGLE_CLIENT_SECRET) are never placed here.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// Create and export the shared Supabase client instance used across the entire frontend
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================================
// STEP 3: MODULE-LEVEL AUTH STATE LISTENER
// ============================================================================
// Register an auth state listener immediately after createClient() (before React mounts)
// so any `SIGNED_IN` or `INITIAL_SESSION` event carrying `session.provider_token` is captured.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    // Persist the Google OAuth access token whenever Supabase delivers a fresh session
    if (session?.provider_token) {
      sessionStorage.setItem('google_provider_token', session.provider_token);
      localStorage.setItem('google_provider_token', session.provider_token);
    }

    // Purge cached Google tokens immediately when the user signs out for security
    if (event === 'SIGNED_OUT') {
      sessionStorage.removeItem('google_provider_token');
      localStorage.removeItem('google_provider_token');
    }
  });
}

// ============================================================================
// STEP 4: MULTI-LAYER GOOGLE PROVIDER TOKEN RESOLVER
// ============================================================================
/**
 * Retrieves the user's Google OAuth 2.0 `provider_token` from all available browser
 * session locations in priority order.
 *
 * Lookup Order:
 *   1. Explicitly passed Supabase `session.provider_token`
 *   2. `sessionStorage.getItem('google_provider_token')`
 *   3. `localStorage.getItem('google_provider_token')`
 *   4. Supabase's internal persisted auth object (`sb-<project-ref>-auth-token` in `localStorage`)
 *
 * @param {Object|null} [session=null] - Optional Supabase Auth session object
 * @returns {string|null} The Google OAuth access token string, or `null` if unavailable
 * @sideEffects Caches the discovered token into `sessionStorage` and `localStorage` if found in fallback layers
 */
export function getGoogleProviderToken(session = null) {
  // Guard against non-browser environments (SSR / build scripts)
  if (typeof window === 'undefined') return null;

  // Priority 1: Check the live Supabase session object passed by the caller
  if (session?.provider_token) {
    sessionStorage.setItem('google_provider_token', session.provider_token);
    localStorage.setItem('google_provider_token', session.provider_token);
    return session.provider_token;
  }

  // Priority 2: Check current tab's sessionStorage
  const fromSession = sessionStorage.getItem('google_provider_token');
  if (fromSession) return fromSession;

  // Priority 3: Check persistent localStorage
  const fromLocal = localStorage.getItem('google_provider_token');
  if (fromLocal) return fromLocal;

  // Priority 4: Inspect Supabase's internal `sb-<project-id>-auth-token` JSON in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.provider_token) {
            sessionStorage.setItem('google_provider_token', parsed.provider_token);
            localStorage.setItem('google_provider_token', parsed.provider_token);
            return parsed.provider_token;
          }
        }
      }
    }
  } catch (e) {
    // Ignore JSON parse or storage access errors
  }

  // No token available — caller should initiate incremental OAuth consent
  return null;
}
