// Import createClient helper from the official Supabase JavaScript SDK
import { createClient } from '@supabase/supabase-js';

// Read the Supabase project URL and anon public key from Vite's environment variables (.env.local)
// In Vite, variables prefixed with "VITE_" are safely accessible in browser client code
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// Create and export the shared Supabase client instance used across the app
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
