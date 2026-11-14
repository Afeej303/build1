import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://jxxfiligudvxqtzkzvzk.supabase.co';
const supabasePublishableKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || '';

export const isSupabaseConfigured = Boolean(
  supabasePublishableKey && !supabasePublishableKey.includes('placeholder')
);

export const supabase = createClient(supabaseUrl, supabasePublishableKey || 'dummy_key_for_init', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
