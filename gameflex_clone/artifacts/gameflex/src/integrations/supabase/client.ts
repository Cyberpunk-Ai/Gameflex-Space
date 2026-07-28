import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://xsakgueycwgloiaiwkti.supabase.co";
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzYWtndWV5Y3dnbG9pYWl3a3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMDMwNTYsImV4cCI6MjA4MTY3OTA1Nn0.JNhZydjCDCb2Zss-OevZ9rIIggZTDgaMguUBfUmLo3s";

const isBrowser = typeof window !== "undefined";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: isBrowser ? window.localStorage : undefined,
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
    },
  },
);
