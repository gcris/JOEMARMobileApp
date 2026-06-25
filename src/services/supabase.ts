import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.EXPO_PUBLIC_SERVICE_ROLE_KEY || "";

export const isSupabaseConfigured = (): boolean => {
  return !!(
    SUPABASE_URL &&
    !SUPABASE_URL.includes("placeholder-project") &&
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY !== "placeholder-anon-key"
  );
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
