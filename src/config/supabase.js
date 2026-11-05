// Import createClient helper from the official Supabase JavaScript SDK
import { createClient } from '@supabase/supabase-js';

// Immediately capture Google OAuth provider_token from URL hash BEFORE GoTrueClient clears it
if (typeof window !== 'undefined' && window.location.hash) {
  try {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const providerToken = hashParams.get('provider_token');
    if (providerToken) {
      sessionStorage.setItem('google_provider_token', providerToken);
      localStorage.setItem('google_provider_token', providerToken);
    }
  } catch (e) {
    console.warn('Could not parse provider_token from URL hash:', e);
  }
}

// Read the Supabase project URL and anon public key from Vite's environment variables (.env.local)
// In Vite, variables prefixed with "VITE_" are safely accessible in browser client code
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// Create and export the shared Supabase client instance used across the app
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Register auth state listener immediately after createClient (as recommended by Supabase docs)
// so provider_token is captured on OAuth callback before any component mounts
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.provider_token) {
      sessionStorage.setItem('google_provider_token', session.provider_token);
      localStorage.setItem('google_provider_token', session.provider_token);
    }
    if (event === 'SIGNED_OUT') {
      sessionStorage.removeItem('google_provider_token');
      localStorage.removeItem('google_provider_token');
    }
  });
}

/**
 * Retrieves the user's Google OAuth provider token from all available browser storage locations:
 * 1. Passed session object
 * 2. sessionStorage ('google_provider_token')
 * 3. localStorage ('google_provider_token')
 * 4. Supabase's internal localStorage key ('sb-*-auth-token')
 */
export function getGoogleProviderToken(session = null) {
  if (typeof window === 'undefined') return null;

  if (session?.provider_token) {
    sessionStorage.setItem('google_provider_token', session.provider_token);
    localStorage.setItem('google_provider_token', session.provider_token);
    return session.provider_token;
  }

  const fromSession = sessionStorage.getItem('google_provider_token');
  if (fromSession) return fromSession;

  const fromLocal = localStorage.getItem('google_provider_token');
  if (fromLocal) return fromLocal;

  // Fallback: inspect Supabase's persisted session in localStorage
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
    // Ignore storage read errors
  }

  return null;
}
