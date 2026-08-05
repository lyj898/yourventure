import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client. The dashboard is a client:only React island, so all
// reads/writes happen live from the browser. The anon key is public by design;
// RLS restricts access to authenticated users.
const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Capture whether we arrived via a password-recovery link BEFORE createClient's
// detectSessionInUrl processes (and strips) the URL hash. This makes the set-password
// screen reliable, rather than depending on catching the async PASSWORD_RECOVERY event.
export const arrivedViaRecovery =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

// Guard so a missing .env.local produces a clear on-screen message instead of a
// cryptic createClient crash.
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // completes the magic-link redirect automatically
      },
    })
  : null;
