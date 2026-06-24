import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://wxqbngmfovgqpyboriru.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4cWJuZ21mb3ZncXB5Ym9yaXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTEyMDcsImV4cCI6MjA5NTYyNzIwN30.eI7XWhwmyEbuMvYwX-sEF0lGJD-hImZ67lboX-zVthE";

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
