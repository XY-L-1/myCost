import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_AUTH_STORAGE_KEY,
  supabaseSessionStorage,
  supabaseUserStorage,
} from "./authStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * supabase
 *
 * Singleton Supabase client used across the app.
 * - Handles authentication
 * - Used by sync engine
 */
export const supabase = createClient(
   supabaseUrl ?? "https://placeholder.supabase.co",
   supabaseAnonKey ?? "placeholder-anon-key",
   {
      auth: {
         storageKey: SUPABASE_AUTH_STORAGE_KEY,
         storage: supabaseSessionStorage,
         userStorage: supabaseUserStorage,
         persistSession: true,
         autoRefreshToken: true,
      },
   }
);
