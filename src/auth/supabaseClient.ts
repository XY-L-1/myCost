import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

/**
 * supabase
 *
 * Singleton Supabase client used across the app.
 * - Handles authentication
 * - Used by sync engine
 */
export const supabase = createClient(
   process.env.EXPO_PUBLIC_SUPABASE_URL!,
   process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
   {
      auth: {
         storage: {
         getItem: SecureStore.getItemAsync,
         setItem: SecureStore.setItemAsync,
         removeItem: SecureStore.deleteItemAsync,
         },
         persistSession: true,
         autoRefreshToken: true,
      },
   }
);